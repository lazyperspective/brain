/* The Loom — Perpetual Motion, piece 3.
 *
 * A 24-second seamless loop at the front of an enormous loom weaving a glowing textile. Eleven sectional
 * spools turn on a rack at the top and pay out 165 warp threads in a band of jewel colours; the threads
 * run through a raddle and two heddle shafts that lift alternate threads, so the shed opens and closes on
 * every pick (the raised and lowered sets lean apart in perspective and shimmer against each other). Four
 * shuttles on four lanes cross on their own rhythms (2, 3, 4 and 6 beats a pass), trailing weft, plucking
 * the warp as they fly. The reed beats three times a second; the cloth ratchets down one pick per beat,
 * 72 picks a loop, and the 72-pick design (eye-dazzler kilim diamonds, a warp-faced ikat whose feathered
 * dye marks can be seen travelling down the warp before they are woven, sawtooth borders and interlocking
 * waves) is woven cell by cell, every over and under drawn. Every frame is a pure function of t, drawn as
 * ramp and level per pixel on a 360 × 450 grid, lit, ordered-dithered into a 47-colour palette and scaled
 * up 3× nearest-neighbour.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 360, H = 450, NP = W * H, D = 24;
  const BEAT = 1 / 3, NB = 72, STRIKE = 0.4;          // 72 beats a loop, the reed strikes at 0.4 of each beat
  const TAU = Math.PI * 2;
  const fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const mod = (a, m) => ((a % m) + m) % m;
  let SEED = 7, BUILT = false;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /* ================================================================ palette: ramps (47 colours) */
  const RAMP_HEX = [
    ['0b0706', '1a100c', '2a1a12', '3e2618', '5a3820', '7a4e2a', '9c6a38', 'c48a4c'], // 0 wood
    ['1a100c', '4a2a0c', '7a4a10', 'b8741a', 'e09a24', 'f5c24a', 'ffe08a', 'fff4c8'], // 1 saffron / gold
    ['1a100c', '3a0c12', '64141c', '8e1f24', 'b8322a', 'de5a3c', 'f28a5e'],           // 2 madder
    ['080a1c', '0c1030', '17205a', '243584', '3550aa', '5677cc', '8aa6e6'],           // 3 indigo
    ['0a1a14', '0f3a2c', '155e40', '1f8a58', '3cb070', '86dca0'],                     // 4 emerald
    ['1a100c', '2a1030', '4a1c50', '6e2c74', '9a4a9a', 'c87ac0'],                     // 5 plum
    ['1a100c', '2a2a30', '5a5a66', '9a9aa4', 'e0e0e8'],                               // 6 steel
    ['3e2618', '8a7a5a', 'c8b48a', 'ecdcb4', 'fff8e8'],                               // 7 ivory
  ];
  const WOOD = 0, GOLD = 1, MAD = 2, IND = 3, EMR = 4, PLM = 5, STL = 6, IVO = 7;
  const PAL = [], RAMPS = [], RLEN = [], RSCL = [];
  (function buildPalette() {
    const seen = {};
    for (const ramp of RAMP_HEX) {
      const idx = [];
      for (const h of ramp) {
        if (!(h in seen)) { seen[h] = PAL.length; PAL.push([parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]); }
        idx.push(seen[h]);
      }
      RAMPS.push(idx); RLEN.push(idx.length); RSCL.push((idx.length - 1) / 6);
    }
  })();
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

  /* ================================================================ layout */
  const NT = 165, X0 = 16, CX = 180;                  // warp threads at x = X0 + 2i
  const XL = 15, XR = 345;                            // selvedges
  const SP_N = 11, SP_CY = 25, SP_R = 13;             // spools
  const RAD_Y = 62;                                    // raddle bar
  const EYE_Y = 140, RAIL_T = 117, RAIL_B = 163, SHAFT = 4;
  const YF = 290;                                     // the fell: first cloth row
  const REED_REST = 274, REED_DROP = 14;              // y of the reed's lower rail at rest; stroke
  const KM = 0;                                   // shed perspective lean
  const txi = (i) => X0 + 2 * i;

  /* ================================================================ buffers */
  const RM = new Uint8Array(NP), LV = new Float32Array(NP), OUT = new Uint8Array(NP);
  const BR = new Uint8Array(NP), BV = new Float32Array(NP);        // static back layer
  const FM = new Uint8Array(NP), FR = new Uint8Array(NP), FV = new Float32Array(NP); // static front layer
  const LF = new Float32Array(NP);                                  // static light field
  function P(x, y, r, v) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x; RM[i] = r; LV[i] = v;
  }
  function PF(x, y, r, v) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x; FM[i] = 1; FR[i] = r; FV[i] = v;
  }

  /* ================================================================ threads: spools & colours */
  const SP_X = [], SP_RAMP = [], SP_LV = [], SP_SPIN = [];
  const SPOOL_ORDER = [EMR, IND, PLM, MAD, GOLD, IVO, GOLD, MAD, PLM, IND, EMR];
  const SPOOL_LV = [3.6, 3.8, 4.0, 3.8, 3.6, 3.9, 3.8, 3.9, 3.9, 4.0, 3.7];
  const SPIN_M = [5, 7, 4, 6, 8, 3, 8, 6, 4, 7, 5];   // turns per loop
  const T_SP = new Uint8Array(NT), T_R = new Uint8Array(NT), T_V = new Float32Array(NT), T_W = new Float32Array(NT);
  function buildThreads() {
    for (let k = 0; k < SP_N; k++) { SP_X.push(30 + 30 * k); SP_RAMP.push(SPOOL_ORDER[k]); SP_LV.push(SPOOL_LV[k]); SP_SPIN.push(SPIN_M[k]); }
    for (let i = 0; i < NT; i++) {
      const k = clamp(fl((i + (ih(i, 7, 1) - 0.5) * 7 + 0.5) / 15), 0, SP_N - 1);
      T_SP[i] = k; T_R[i] = SP_RAMP[k]; T_V[i] = SP_LV[k] + (ih(i, 7, 2) - 0.5) * 0.7;
      T_W[i] = T_V[i] - 0.7;
    }
  }

  /* ================================================================ the design (72 picks) */
  const MID = 82;
  // ikat: dye marks on the warp itself. Returns [ramp, level] or null.
  function dye(i, j) {
    if (j < 34 || j > 51) return null;
    const jj = j - 42.5;
    const per = 24;
    let di = mod(i - MID + 12, per) - 12;             // -12..11
    const m = Math.round((i - MID - di) / per);
    const feather = (ih(i, 3, 11) - 0.5) * 2.4 + (ih(i >> 1, 5, 12) - 0.5) * 1.4;
    const u = Math.abs(di + 0.5) / 12.5 + (Math.abs(jj) + feather) / 9.5;
    const alt = (m & 1) === 0;
    if (u < 0.28) return alt ? [GOLD, 5.6] : [IVO, 5.2];
    if (u < 0.5) return alt ? [MAD, 4.3] : [GOLD, 4.4];
    if (u < 0.64) return [IVO, 4.9];
    if (u < 0.86) return alt ? [IND, 3.2] : [MAD, 3.4];
    // background: dark indigo with feathered arrow ticks between lozenges
    const tick = Math.abs(Math.abs(di + 0.5) - 12) < 1.6 && Math.abs(jj + feather * 0.6) < 6.5;
    if (tick) return [GOLD, 4.0];
    return null;
  }
  // weft colour and face of a cell. face: 0 weft-faced, 1 warp-faced, 2 balanced.
  const CELL = { face: 0, r: 0, v: 0 };
  function weft(i, j) {
    const c = CELL;
    c.face = 0;
    const per = 30;
    if (j <= 1) { c.face = 2; c.r = GOLD; c.v = 4.6; return c; }
    if (j <= 3) { c.r = MAD; c.v = 2.6; return c; }
    if (j <= 5) { const dot = mod(i + (j & 1) * 2, 4) === 0; c.r = dot ? IVO : GOLD; c.v = dot ? 4.6 : 4.1; return c; }
    if (j <= 29) {                                    // eye-dazzler kilim diamonds
      const jj = j - 6;
      let di = mod(i - MID + 15, per) - 15;
      const m = Math.round((i - MID - di) / per);
      const dj = Math.abs(jj - 11.5);
      const u = (Math.abs(di) + 0.5) / 15.5 + dj / 12.5;
      if (u < 1) {
        const ring = fl(u * 7.5);
        const A = (m & 1) === 0;
        const seq = A
          ? [[EMR, 4.6], [IVO, 4.8], [MAD, 4.2], [GOLD, 5.4], [IND, 2.4], [MAD, 3.6], [GOLD, 4.6], [IND, 1.8]]
          : [[GOLD, 5.8], [MAD, 4.4], [IND, 3.0], [IVO, 4.8], [EMR, 3.6], [MAD, 3.6], [GOLD, 4.6], [IND, 1.8]];
        const s = seq[ring]; c.r = s[0]; c.v = s[1];
        // latch hooks off the outer gold ring
        return c;
      }
      const u2 = 2 - u;                                 // the interlocking half-diamonds between
      const ring = fl(u2 * 7.5);
      const seq2 = [[PLM, 4.4], [IVO, 4.6], [PLM, 3.0], [GOLD, 4.0], [IND, 1.8], [MAD, 3.6], [GOLD, 4.6], [IND, 1.8]];
      const s = seq2[clamp(ring, 0, 7)]; c.r = s[0]; c.v = s[1];
      return c;
    }
    if (j <= 31) { c.r = MAD; c.v = 2.8; return c; }
    if (j <= 33) {                                    // sawtooth
      const k = j - 32;
      const tooth = Math.abs(mod(i, 8) - 3.5) < 1.5 + k * 1.5;
      c.r = tooth ? GOLD : MAD; c.v = tooth ? 4.8 : 3.2; return c;
    }
    if (j <= 51) { c.face = 1; c.r = IND; c.v = 1.5; return c; }   // ikat: the warp shows
    if (j <= 53) {
      const k = j - 52;
      const tooth = Math.abs(mod(i + 4, 8) - 3.5) < 3 - k * 1.5;
      c.r = tooth ? GOLD : MAD; c.v = tooth ? 4.8 : 3.2; return c;
    }
    if (j <= 69) {                                    // interlocking waves
      const jj = j - 54;                               // 0..15
      const env = 0.55 + 0.45 * Math.cos(TAU * (i - MID) / 165);
      const ph = TAU * (i - MID) / 28;
      const bnd = 7.5 + 5.6 * env * Math.sin(ph);
      const a = jj - bnd;
      if (Math.abs(a) < 0.75) { c.r = IVO; c.v = 4.9; return c; }
      if (a < 0) {
        const e = mod(Math.round(-a), 4);
        if (e === 2) { c.r = EMR; c.v = 4.6; return c; }
        c.r = EMR; c.v = 2.9; return c;
      }
      const e = mod(Math.round(a), 4);
      if (e === 2) { c.r = GOLD; c.v = 5.4; return c; }
      c.r = MAD; c.v = 3.7; return c;
    }
    c.face = 2; c.r = IVO; c.v = 4.4; return c;
  }
  // per cell pixel (s = sy * 2 + sx) ramp and level, precomputed for the whole repeat
  const CR = new Uint8Array(NB * NT * 4), CV = new Float32Array(NB * NT * 4);
  const BUMP_H = [0.7, 0.95, -0.25, -0.7];  // weft over: lit top row
  const DIP_H = [-0.45, -0.6, -1.0, -1.25];
  const BUMP_V = [0.75, -0.2, 0.5, -0.7];   // warp over: lit left column
  const DIP_V = [-0.5, -1.0, -0.65, -1.2];
  function buildCloth() {
    for (let j = 0; j < NB; j++) for (let i = 0; i < NT; i++) {
      const c = weft(i, j);
      const face = c.face, wr = c.r, wv = c.v + (ih(i, j, 21) - 0.5) * 0.35;
      const d = dye(i, j);
      const ar = d ? d[0] : T_R[i], av = (d ? d[1] : T_V[i]) + (ih(i, j, 22) - 0.5) * 0.3;
      const q = (i + j) & 1;               // 0: weft passes over this warp
      const base = (j * NT + i) * 4;
      for (let s = 0; s < 4; s++) {
        let r, v;
        if (face === 0) { r = wr; v = wv + (q === 0 ? BUMP_H[s] : DIP_H[s]); }
        else if (face === 1) { r = ar; v = av + (q === 1 ? BUMP_V[s] : DIP_V[s]); }
        else { if (q === 0) { r = wr; v = wv + BUMP_H[s]; } else { r = ar; v = av + BUMP_V[s]; } }
        CR[base + s] = r; CV[base + s] = v;
      }
    }
  }

  /* ================================================================ static layers */
  function buildLight() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const hx = (x - 180) / 175;
      const hf = Math.exp(-hx * hx * 0.9);
      // the cloth glows: light pools at the fell and climbs the warp
      const up = y < YF ? Math.exp(-Math.pow((YF - y) / 150, 2)) : Math.exp(-Math.pow((y - YF) / 210, 2));
      let L = -2.2 + 2.6 * up * (0.55 + 0.45 * hf);
      // a softer lamp over the spool rack
      L += 1.5 * Math.exp(-Math.pow((y - 26) / 34, 2)) * (0.5 + 0.5 * hf);
      // two warm shafts from the upper left
      const s1 = (x - 0.5 * y) - 60, s2 = (x - 0.5 * y) - 168;
      L += 0.9 * Math.exp(-(s1 * s1) / 300) * sstep(30, 160, y) * (1 - sstep(260, 440, y));
      L += 0.6 * Math.exp(-(s2 * s2) / 160) * sstep(30, 180, y) * (1 - sstep(270, 450, y));
      L -= 1.0 * sstep(340, 450, y);
      LF[y * W + x] = L;
    }
  }
  function buildBack() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // dark planked wall far behind the warp
      const plank = mod(x + (y > 200 ? 9 : 0), 23) === 0 ? -0.5 : 0;
      const grain = (ih(x >> 1, y >> 3, 31) - 0.5) * 0.3;
      BR[i] = WOOD; BV[i] = 1.1 + plank + grain;
    }
    // top lintel
    for (let y = 0; y < 6; y++) for (let x = 0; x < W; x++) {
      const v = y === 5 ? 1.2 : y === 4 ? 3.6 : 2.4 + (ih(x >> 2, y, 33) - 0.5) * 0.6;
      BR[y * W + x] = WOOD; BV[y * W + x] = v;
    }
    // the rack beam behind the spools
    for (let y = SP_CY - 3; y <= SP_CY + 3; y++) for (let x = 14; x < 346; x++) {
      const i = y * W + x, e = y - SP_CY;
      BR[i] = WOOD; BV[i] = e === -3 ? 3.8 : e === 3 ? 1.0 : 2.4 + (ih(x >> 3, y, 34) - 0.5) * 0.5;
    }
  }
  function buildFront() {
    // the two posts
    for (const side of [0, 1]) {
      const xa = side ? 346 : 0, xb = side ? 359 : 13;
      for (let y = 0; y < H; y++) for (let x = xa; x <= xb; x++) {
        const u = side ? (x - xa) : (xb - x);           // 0 at the inner edge
        let v = 2.6 - u * 0.09;
        if (u === 0) v = 4.4; else if (u === 1) v = 3.5;
        if (u === 13) v = 0.6;
        const grain = Math.sin((y * 0.06 + x * 0.9) + Math.sin(y * 0.017 + x) * 2.3) * 0.35 + (ih(x, y >> 2, 41) - 0.5) * 0.4;
        if (u > 1) v += grain;
        if (mod(y + x * 7, 61) === 0 && u > 3 && u < 11) v -= 0.9;  // knots
        PF(x, y, WOOD, v);
      }
      // iron straps and bolts
      for (const by of [8, 112, 170, 300, 400]) {
        for (let y = by; y < by + 5; y++) for (let x = xa; x <= xb; x++) PF(x, y, STL, y === by ? 3.2 : y === by + 4 ? 1.0 : 2.1);
        const bx = side ? xa + 6 : xb - 6;
        PF(bx, by + 2, STL, 5.4); PF(bx + 1, by + 2, STL, 3.4); PF(bx, by + 3, STL, 2.6);
      }
      // shuttle boxes at the lanes
      for (const ln of LANES) {
        const y0 = ln.y - 5, y1 = ln.y + 5;
        for (let y = y0; y <= y1; y++) for (let x = xa; x <= xb; x++) {
          const u = side ? (x - xa) : (xb - x);
          let v = y === y0 ? 4.6 : y === y1 ? 0.9 : 2.0 - u * 0.05;
          if (u === 0 && y > y0 && y < y1) v = 0.4;       // the mouth
          PF(x, y, WOOD, v);
        }
        const mx = side ? xa : xb;
        for (let y = y0 + 1; y < y1; y++) FM[y * W + mx] = 0;  // open mouth: shuttle tip shows
      }
    }
  }

  /* ================================================================ timing */
  function beatAt(t) {
    const bt = t / BEAT;
    const n = fl(bt + 1e-7), ph = bt - n;
    const cnt = n + (ph >= STRIKE ? 1 : 0);
    const since = ph >= STRIKE ? ph - STRIKE : ph + 1 - STRIKE;   // beats since the last strike
    return { n, ph, cnt, since };
  }
  function reedDrop(ph) {
    if (ph < 0.2) return 0;
    if (ph < STRIKE) { const u = (ph - 0.2) / (STRIKE - 0.2); return u * u * u; }
    return 1 - sstep(STRIKE + 0.02, 0.85, ph);
  }
  function shedAt(b) {
    const tgt = (c) => ((c & 1) ? -1 : 1);
    if (b.ph < STRIKE) return tgt(b.n);
    return lerp(tgt(b.n), tgt(b.n + 1), sstep(0.44, 0.7, b.ph));
  }

  /* ================================================================ shuttles */
  const LANES = [
    { y: 192, T: 6, o: 4, r: EMR, v: 4.4 },
    { y: 208, T: 4, o: 2, r: IVO, v: 4.2 },
    { y: 224, T: 3, o: 0, r: MAD, v: 4.6 },
    { y: 240, T: 2, o: 1, r: GOLD, v: 5.0 },
  ];
  const REST_L = 2, REST_R = 357, TRAVEL0 = 0.75, ARRIVE = 0.55;
  const ease = (f) => 0.35 * f + 0.65 * (1 - (1 - f) * (1 - f));
  function shuttleAt(ln, t) {
    const tau = mod(t / BEAT - ln.o, NB);
    const q = fl((tau - TRAVEL0) / ln.T);
    const local = tau - TRAVEL0 - q * ln.T;
    const dir = (mod(q, 2) === 0) ? 1 : -1;
    const xs = dir > 0 ? REST_L : REST_R, xe = dir > 0 ? REST_R : REST_L;
    const dur = ln.T - ARRIVE;
    const s = { x: 0, dir, flying: false, f: 0, local, dur, from: dir > 0 ? XL : XR, beaten: false, speed: 0 };
    if (local < dur) {
      const f = local / dur; s.flying = true; s.f = f; s.x = lerp(xs, xe, ease(f));
      s.speed = (xe - xs) * (0.35 + 1.3 * (1 - f)) / (dur * BEAT);
    } else {
      s.x = xe;
      // the strike at local = T - 0.35 weaves this pick
      s.beaten = local >= ln.T - 0.35;
    }
    return s;
  }
  // when did this shuttle pass column x (seconds ago), or -1
  function passAge(ln, t, x) {
    const s = shuttleAt(ln, t);
    if (!s.flying && s.local < s.dur) return -1;
    const xs = s.dir > 0 ? REST_L : REST_R, xe = s.dir > 0 ? REST_R : REST_L;
    const e = (x - xs) / (xe - xs);
    if (e <= 0 || e >= 1) return -1;
    // invert ease: e = 0.35 f + 0.65 (2f - f^2) = 1.65 f - 0.65 f^2
    const f = (1.65 - Math.sqrt(1.65 * 1.65 - 4 * 0.65 * e)) / (2 * 0.65);
    const lp = f * s.dur;
    if (s.flying && lp > s.local) return -1;
    return (s.local - lp) * BEAT;
  }

  /* ================================================================ drawing: spools */
  function drawSpools(t, cnt) {
    const R = SP_R, FR_ = R + 3;
    for (let k = 0; k < SP_N; k++) {
      const cx = SP_X[k], r = SP_RAMP[k], bv = SP_LV[k];
      const spin = SP_SPIN[k] * t / D;          // turns
      // drum: cross-wound thread
      for (let y = SP_CY - R; y <= SP_CY + R; y++) {
        const cy = (SP_CY - y) / R;
        const th = Math.acos(clamp(cy, -1, 1));   // 0 top .. PI bottom
        const lam = 0.62 * Math.cos(th) + 0.78 * Math.sin(th);
        for (let x = cx - 11; x <= cx + 10; x++) {
          const a = th / TAU * 26 + spin * 26;
          const f1 = a + (x - cx) * 0.32, f2 = a - (x - cx) * 0.32;
          const g1 = f1 - fl(f1), g2 = f2 - fl(f2);
          let v = bv - 2.7 + lam * 3.3;
          if (g1 < 0.28) v += 0.8; else if (g2 < 0.28) v += 0.5; else v -= 0.3;
          if (Math.abs(th - 0.75) < 0.16) v += 0.9;               // the lamp's sheen
          if (x === cx - 11 || x === cx + 10) v -= 0.8;
          P(x, y, r, v);
        }
      }
      // flanges, edge on, with a peg that turns
      const pegY = SP_CY + Math.cos(TAU * spin) * (FR_ - 2), pegFront = Math.sin(TAU * spin) > 0;
      for (const fx of [cx - 14, cx + 11]) {
        for (let y = SP_CY - FR_; y <= SP_CY + FR_; y++) {
          const e = Math.abs(y - SP_CY);
          for (let x = fx; x < fx + 3; x++) {
            if (e === FR_ && x !== fx + 1) continue;
            let v = 3.4 - (y - SP_CY) * 0.09 + (x === fx ? 0.9 : x === fx + 2 ? -0.8 : 0);
            if (e >= FR_ - 1) v -= 0.6;
            P(x, y, WOOD, v);
          }
        }
        if (pegFront) { const py = Math.round(pegY); P(fx + 1, py, GOLD, 6.4); P(fx, py, GOLD, 4.4); P(fx + 2, py, GOLD, 3.2); }
        for (let sp = 0; sp < 3; sp++) {
          const an = TAU * (spin + sp / 3);
          if (Math.sin(an) > 0.2) { const py = Math.round(SP_CY + Math.cos(an) * 8); P(fx + 1, py, WOOD, 0.8); P(fx + 1, py + 1, WOOD, 1.2); }
        }
      }
      P(cx - 15, SP_CY, STL, 4.4); P(cx + 14, SP_CY, STL, 4.4);
    }
  }

  /* ================================================================ drawing: warp, shed, shuttles */
  const VIB = new Float32Array(NT);
  const OFFE = new Float32Array(NT);
  function drawThread(i, sideV, cnt, eyeY, vib) {
    const x0 = txi(i), r0 = T_R[i], v0 = T_W[i];
    const k = T_SP[i], scx = SP_X[k];
    const xTop = scx + (x0 - scx) * 0.7;
    const lean = sideV * KM * (x0 - CX);
    const raisedB = sideV > 0 ? 0.8 * sideV : 1.5 * sideV;   // the lowered set sits in the shadow of the raised
    // spool to raddle: the fan
    const yS = SP_CY + SP_R + 1;
    for (let y = yS; y < RAD_Y; y++) {
      const u = (y - yS) / (RAD_Y - yS);
      const x = Math.round(lerp(xTop, x0, u * u * (3 - 2 * u)));
      const w = cnt + fl((YF - y) / 2);
      const d = dye(i, mod(w, NB));
      const tw = mod(y + 2 * cnt + i, 3) === 0 ? 0.5 : 0;
      P(x, y, d ? d[0] : r0, (d ? v0 + (d[1] - 3.6) * 0.3 : v0) - 0.3 + tw);
    }
    // raddle to fell
    const span1 = eyeY - RAD_Y, span2 = YF - eyeY;
    for (let y = RAD_Y; y < YF; y++) {
      let prof, vb = 0;
      if (y < eyeY) prof = (y - RAD_Y) / span1;
      else {
        prof = (YF - y) / span2;
        vb = vib * Math.sin(Math.PI * (y - eyeY) / span2);
      }
      const x = Math.round(x0 + lean * prof + vb);
      const w = cnt + fl((YF - y) / 2);
      const d = dye(i, mod(w, NB));
      const tw = mod(y + 2 * cnt + i, 3) === 0 ? 0.5 : 0;
      let v = (d ? v0 + (d[1] - 3.6) * 0.35 : v0) + tw + raisedB * Math.min(1, prof * 1.6);
      if (y >= YF - 3) v -= 0.4;
      P(x, y, d ? d[0] : r0, v);
    }
  }
  const SH_PROF = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 0, 0, 0];
  const SH_LEN = SH_PROF.length, SH_HALF = SH_LEN >> 1;
  function drawShuttle(ln, s, t) {
    const hx = Math.round(s.x) - SH_HALF, yc = ln.y;
    const roll = fl(t * 40);
    for (let c = 0; c < SH_LEN; c++) {
      const hh = SH_PROF[c], x = hx + c;
      for (let e = -hh; e <= hh; e++) {
        const y = yc + e;
        let r = WOOD, v = 5.0 - e * 0.5 + (ih(c >> 2, 0, 52) - 0.5) * 0.3;
        if (c < 6 || c >= SH_LEN - 6) { r = GOLD; v = 4.6 - e * 0.7; if (c === 0 || c === SH_LEN - 1 || e === -hh) v += 1.2; }
        else if (c >= 12 && c <= 25 && Math.abs(e) <= 2) {
          if (Math.abs(e) === 2 || c === 12 || c === 25) { r = WOOD; v = 1.2; }
          else { r = ln.r; v = ln.v + 0.4 - Math.abs(e) * 0.9 + (mod(c * 2 + e + roll * s.dir, 4) === 0 ? 1.0 : 0); }
        } else if (e === -hh) v = 6.6;
        else if (e === -hh + 1) v = 5.8;
        else if (e === hh) v = 2.2;
        P(x, y, r, v);
      }
    }
    // streak behind a fast shuttle
    if (s.flying) {
      const sp = Math.abs(s.speed);
      const L = clamp(Math.round(sp / 32), 0, 48);
      for (let k = 1; k <= L; k++) {
        const x = Math.round(s.x) - s.dir * (SH_HALF + k);
        const fade = 1 - k / (L + 1);
        if (ih(x, k, 51) < 0.2 + 0.7 * fade) P(x, yc + ((k & 1) ? -3 : 3), ln.r, ln.v - 0.6 + fade * 1.8);
        if (k < L * 0.7 && ih(x, k, 53) < 0.8) P(x, yc - 1 + (k % 3), GOLD, 2.6 + fade * 3.4);
      }
    }
  }
  function drawTrail(ln, s, rd) {
    // weft from where it is anchored to the shuttle's tail
    let ax, ay = YF - 1, bx, by = ln.y;
    if (s.flying) { ax = s.from; bx = s.x - s.dir * SH_HALF; }
    else if (!s.beaten) { ax = s.dir > 0 ? XL : XR; bx = s.x - s.dir * SH_HALF; }
    else { ax = s.dir > 0 ? XR : XL; bx = s.x + (s.dir > 0 ? -SH_HALF : SH_HALF); }   // new pick: anchored on this side
    const pushed = !s.flying && !s.beaten;
    const reedBot = REED_REST + Math.round(REED_DROP * rd) + 1;
    const xa = Math.min(ax, bx), xb = Math.max(ax, bx);
    const dx = bx - ax;
    if (Math.abs(dx) < 1) { for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) P(ax, y, ln.r, ln.v); return; }
    let lastY = null;
    for (let x = Math.round(xa); x <= Math.round(xb); x++) {
      const u = (x - ax) / dx;
      let y = lerp(ay, by, u) + Math.sin(Math.PI * u) * 3;
      if (pushed) y = Math.max(y, reedBot);
      y = Math.min(y, YF - 1);
      const yi = Math.round(y);
      // keep the line connected on steep parts
      if (lastY !== null && Math.abs(yi - lastY) > 1) {
        const st = yi > lastY ? 1 : -1;
        for (let yy = lastY + st; yy !== yi; yy += st) P(x, yy, ln.r, ln.v - 0.3);
      }
      P(x, yi, ln.r, ln.v + 0.5 + ((x & 3) === 0 ? 0.9 : 0));
      lastY = yi;
    }
  }
  function drawLoomMid(t, b) {
    const sh = shedAt(b);
    const rd = reedDrop(b.ph);
    const eyeA = EYE_Y - SHAFT * sh, eyeB = EYE_Y + SHAFT * sh;
    // vibration from shuttles passing, and from the strike
    const S = LANES.map((ln) => shuttleAt(ln, t));
    const strikeEnv = Math.exp(-b.since * 3.2);
    for (let i = 0; i < NT; i++) {
      const x = txi(i);
      let a = 0;
      for (let l = 0; l < LANES.length; l++) {
        const age = passAge(LANES[l], t, x);
        if (age >= 0 && age < 0.6) a += 1.7 * Math.exp(-age * 7) * Math.cos(age * 55 + i);
      }
      a += 0.9 * strikeEnv * Math.sin(b.since * 30 + ih(i, 1, 61) * TAU) * (ih(i, b.cnt, 62) < 0.5 ? 1 : 0);
      VIB[i] = a;
    }
    // lowered set first
    const setA = sh >= 0 ? 1 : 0;           // which parity is raised (even = A)
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < NT; i++) {
        const even = (i & 1) === 0;
        const sideV = even ? sh : -sh;
        const raised = sideV >= 0;
        if ((pass === 0) === raised) continue;
        drawThread(i, sideV, b.cnt, even ? eyeA : eyeB, VIB[i]);
      }
      if (pass === 0) {
        for (let l = 0; l < LANES.length; l++) drawTrail(LANES[l], S[l], rd);
        for (let l = 0; l < LANES.length; l++) drawShuttle(LANES[l], S[l], t);
      }
    }
    void setA;
    drawRaddle();
    drawHeddles(sh, eyeA, eyeB);
    drawReed(rd, b);
    return S;
  }
  function drawRaddle() {
    for (let y = RAD_Y - 3; y <= RAD_Y + 1; y++) for (let x = 10; x < 350; x++) {
      const e = y - RAD_Y;
      let v = e === -3 ? 4.4 : e === 1 ? 1.0 : 2.6 + (ih(x >> 3, 1, 71) - 0.5) * 0.4;
      P(x, y, WOOD, v);
    }
    for (let i = 0; i <= NT; i++) { const x = txi(i) - 1; P(x, RAD_Y + 2, STL, 3.6); P(x, RAD_Y + 3, STL, 2.2); }
  }
  function drawRail(y0, v0) {
    const SH = [2.1, 1.2, 0.5, 1.3, -0.5, -1.7];
    for (let e = 0; e < 6; e++) {
      const y = y0 + e - 1;
      for (let x = 10; x < 350; x++) {
        const r = e === 3 ? STL : WOOD;
        let v = v0 + SH[e] + (e !== 3 ? (Math.sin(x * 0.07 + e * 2.1 + Math.sin(x * 0.023 + y0) * 2) * 0.3 + (ih(x >> 3, e, 72) - 0.5) * 0.3) : 0);
        if (e === 3 && mod(x, 24) === 4) v += 2.0;   // rivets
        P(x, y, r, v);
      }
    }
  }
  function drawHeddles(sh, eyeA, eyeB) {
    const dA = -SHAFT * sh, dB = SHAFT * sh;
    // wires, on the gap column beside each thread
    for (let i = 0; i < NT; i++) {
      const even = (i & 1) === 0;
      const dy = even ? dA : dB, sideV = even ? sh : -sh;
      const xw = Math.round(txi(i) + sideV * KM * (txi(i) - CX)) + 1;
      const yt = Math.round(RAIL_T + dy) + 5, yb = Math.round(RAIL_B + dy) - 1;
      const ye = Math.round(even ? eyeA : eyeB);
      const vb = sideV > 0 ? 2.4 : 1.5;
      for (let y = yt; y <= yb; y++) {
        if (y === ye) continue;
        P(xw, y, STL, vb + (Math.abs(y - ye) === 1 ? 2.4 : 0) + (mod(y + i, 7) === 0 ? 0.7 : 0));
      }
      P(xw - 1, ye, STL, 5.4);   // the eye glints on the thread
    }
    // rails: the lowered shaft behind, darker
    const lowFirst = sh >= 0 ? [dB, dA] : [dA, dB];
    for (let q = 0; q < 2; q++) {
      const dy = lowFirst[q], vv = q === 0 ? 3.6 : 4.8;
      drawRail(Math.round(RAIL_T + dy), vv);
      drawRail(Math.round(RAIL_B + dy), vv);
    }
  }
  function drawReed(rd, b) {
    const off = Math.round(REED_DROP * rd);
    const yb = REED_REST + off;                // lower edge of bottom rail
    const flash = b.since < 0.35 ? (1 - b.since / 0.35) : 0;
    // dents
    for (let i = 0; i <= NT; i++) {
      const x = txi(i) - 1;
      for (let y = yb - 18; y <= yb - 3; y++) P(x, y, STL, 2.5 + (y === yb - 13 ? 1.8 : 0) + flash * 1.4);
    }
    // bottom rail (3) and the heavy beater beam (6)
    for (let y = yb - 2; y <= yb; y++) for (let x = 10; x < 350; x++) P(x, y, WOOD, (y === yb - 2 ? 4.6 : y === yb ? 1.4 : 3.2) + flash * 0.8);
    const BEAM = [6.4, 5.4, 4.6, 4.0, 3.2, 1.6];
    for (let e = 0; e < 6; e++) {
      const y = yb - 24 + e;
      for (let x = 10; x < 350; x++) {
        let v = BEAM[e] + (e > 0 && e < 5 ? (Math.sin(x * 0.09 + e * 1.7 + Math.sin(x * 0.031) * 3) * 0.3 + (ih(x >> 2, e, 81) - 0.5) * 0.3) : 0);
        P(x, y, WOOD, v + flash * 0.7);
      }
    }
  }

  /* ================================================================ drawing: cloth */
  function drawCloth(b) {
    const glowBase = 1.5 * Math.exp(-b.since * 2.2);
    for (let y = YF; y < H; y++) {
      const r = (y - YF) >> 1, sy = (y - YF) & 1;
      const j = mod(b.cnt - 1 - r, NB);
      const glow = (r === 0 ? glowBase + 0.4 : 0) + 0.75 * Math.exp(-r / 3.5);
      const rowBase = j * NT * 4 + sy * 2;
      const row = y * W;
      for (let i = 0; i < NT; i++) {
        const k = rowBase + i * 4, x = txi(i);
        RM[row + x] = CR[k]; LV[row + x] = CV[k] + glow;
        RM[row + x + 1] = CR[k + 1]; LV[row + x + 1] = CV[k + 1] + glow;
      }
      // selvedges: weft turning round the edge
      const c = weft(0, j);
      if (((r + sy) & 1) === 0) { P(XL, y, c.r, c.v - 0.5); }
      else P(XL, y, WOOD, 0.8);
      const c2 = weft(NT - 1, j);
      if (((r + sy + 1) & 1) === 0) P(XR - 0 + 0, y, c2.r, c2.v - 0.5);
      else P(XR, y, WOOD, 0.8);
    }
    // the fell catches the light on every strike
    if (b.since < 0.5) {
      const f = 1 - b.since / 0.5;
      for (let x = XL; x <= XR; x++) { const i = YF * W + x; LV[i] += 2.2 * f; LV[i + W] += 1.0 * f; }
    }
  }

  // leather pickers that throw the shuttles: they snap in as a shuttle leaves their side
  function drawPickers(t) {
    for (const ln of LANES) {
      const tau = mod(t / BEAT - ln.o, NB);
      const q = fl((tau - TRAVEL0) / ln.T);
      const local = tau - TRAVEL0 - q * ln.T;
      const dir = (mod(q, 2) === 0) ? 1 : -1;
      for (const side of [-1, 1]) {
        let kick = 0;
        if ((side < 0 && dir > 0) || (side > 0 && dir < 0)) kick = local < 0.5 ? Math.sin(Math.PI * clamp(local / 0.5, 0, 1)) : 0;
        else kick = 0;
        const reach = Math.round(1 + 6 * kick);
        for (let k = 0; k <= reach; k++) {
          const x = side < 0 ? 13 + k : 346 - k;
          for (let e = -2; e <= 2; e++) P(x, ln.y + e, k === reach ? MAD : WOOD, (k === reach ? 3.6 : 3.0) - e * 0.5 + 1.2);
        }
      }
    }
  }

  /* ================================================================ motes */
  const MOTES = [];
  function buildMotes() {
    for (let k = 0; k < 300; k++) {
      MOTES.push({
        x: 14 + ih(k, 1, 91) * 332, y: 40 + ih(k, 2, 91) * 400,
        ax: 4 + ih(k, 3, 91) * 16, ay: 3 + ih(k, 4, 91) * 12,
        fx: 1 + fl(ih(k, 5, 91) * 3), fy: 1 + fl(ih(k, 6, 91) * 2),
        px: ih(k, 7, 91) * TAU, py: ih(k, 8, 91) * TAU,
        rise: ih(k, 9, 91) < 0.35 ? 1 : 0,
        tw: 2 + fl(ih(k, 10, 91) * 6), tp: ih(k, 11, 91) * TAU,
        fib: ih(k, 12, 91) < 0.3, spin: (ih(k, 13, 91) < 0.5 ? -1 : 1) * (1 + fl(ih(k, 14, 91) * 3)),
        r: ih(k, 15, 91) < 0.7 ? GOLD : IVO,
      });
    }
  }
  function drawMotes(t) {
    const u = t / D;
    for (const m of MOTES) {
      let x = m.x + m.ax * Math.sin(TAU * m.fx * u + m.px);
      let y = m.y + m.ay * Math.sin(TAU * m.fy * u + m.py);
      if (m.rise) y = mod(y - 420 * u - 40, 420) + 30;
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 15 || xi > 344 || yi < 0 || yi >= H) continue;
      const tw = 0.5 + 0.5 * Math.sin(TAU * m.tw * u + m.tp);
      const lit = LF[yi * W + xi];
      const v = 4.0 + tw * 2.6 + lit * 0.6 - LF[yi * W + xi];   // motes carry their own light
      const sparkle = tw > 0.9 && lit > -0.6;
      if (v + lit < 3.2) continue;
      P(xi, yi, m.r, v + 0.6);
      if (sparkle) { P(xi - 1, yi, m.r, v - 1.4); P(xi + 1, yi, m.r, v - 1.4); P(xi, yi - 1, m.r, v - 1.4); P(xi, yi + 1, m.r, v - 1.4); }
      else if (m.fib) {
        const an = TAU * m.spin * u + m.px;
        const ox = Math.round(Math.cos(an) * 1.6), oy = Math.round(Math.sin(an) * 1.6);
        P(xi + ox, yi + oy, m.r, v - 0.8);
        P(xi - ox, yi - oy, m.r, v - 1.5);
      }
    }
  }
  function drawPuffs(t, b) {
    // fibres knocked loose at the fell by the last few strikes
    for (let back = 0; back < 4; back++) {
      const n = b.cnt - 1 - back;          // strike index
      const age = (b.since + back) * BEAT; // seconds since that strike
      if (age > 1.1) continue;
      const nn = mod(n, NB);
      for (let p = 0; p < 9; p++) {
        const x0 = XL + ih(nn, p, 101) * (XR - XL);
        const vx = (ih(nn, p, 102) - 0.5) * 50, vy = -25 - ih(nn, p, 103) * 45;
        const x = x0 + vx * age, y = YF - 1 + vy * age + 30 * age * age;
        const v = 5.6 - age * 4.2;
        if (v < 2.5) continue;
        P(Math.round(x), Math.round(y), ih(nn, p, 104) < 0.5 ? GOLD : IVO, v);
      }
    }
  }

  function glow(cx, cy, R, I) {
    const x0 = Math.max(0, fl(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, fl(cy - R)), y1 = Math.min(H - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = (y - cy) * 1.6, d = Math.sqrt(dx * dx + dy * dy) / R;
      if (d < 1) LV[y * W + x] += I * (1 - d) * (1 - d);
    }
  }
  /* ================================================================ frame */
  function drawFrame(t) {
    t = ((t % D) + D) % D;
    const b = beatAt(t);
    RM.set(BR); LV.set(BV);
    drawSpools(t, b.cnt);
    const S = drawLoomMid(t, b);
    drawCloth(b);
    for (let l = 0; l < LANES.length; l++) {
      const s = S[l];
      if (s.flying) glow(s.x, LANES[l].y, 22, 1.1 + Math.min(1, Math.abs(s.speed) / 900));
    }
    // front layer
    for (let i = 0; i < NP; i++) if (FM[i]) { RM[i] = FR[i]; LV[i] = FV[i]; }
    drawPickers(t);
    drawPuffs(t, b);
    drawMotes(t);
    // light and quantise
    for (let y = 0; y < H; y++) {
      const by = (y & 3) << 2;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, r = RM[i];
        let q = fl((LV[i] + LF[i]) * RSCL[r] + BAY[by | (x & 3)]);
        const n = RLEN[r];
        q = q < 0 ? 0 : q >= n ? n - 1 : q;
        OUT[i] = RAMPS[r][q];
      }
    }
  }

  /* ================================================================ present */
  let IMG = null, SMALL = null, SG = null;
  function present(g) {
    if (!SMALL) { SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H; SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); }
    const d = IMG.data;
    for (let i = 0, j = 0; i < NP; i++, j += 4) { const p = PAL[OUT[i]]; d[j] = p[0]; d[j + 1] = p[1]; d[j + 2] = p[2]; d[j + 3] = 255; }
    SG.putImageData(IMG, 0, 0);
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(SMALL, 0, 0, g.canvas.width, g.canvas.height);
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'the-loom',
    title: 'The Loom',
    medium: 'Pixel art in 47 colours, 360 × 450, woven in JavaScript · 24 s loop',
    note: 'Three picks a second, every crossing drawn · tap to pause',
    about: 'The front of an enormous loom weaving a glowing cloth. Eleven spools turn on the rack and pay out 165 warp threads in a band of jewel colours; two heddle shafts lift alternate threads to open the shed, four shuttles cross it on their own rhythms trailing weft, and the reed beats three times a second. The cloth ratchets down one pick at a time: eye-dazzler kilim diamonds, sawtooth borders, interlocking waves and a feathered ikat whose dye marks you can watch travelling down the warp before they are woven in. Every over and under of every thread is drawn, pixel by pixel, in code.',
    tone: 'dark',
    room: '#0b0706',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      SEED = (api.seed >>> 0) % 100000 || 7;
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = '#0b0706';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(255,244,200,.85)"/><rect x="19" y="9" width="5" height="16" fill="rgba(255,244,200,.85)"/></svg>';
      el.appendChild(pauseMark);
      function layout() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1080; cssH = 1350; cv.style.position = 'fixed';
          const K = Math.max(1, Math.round(3 * dpr)); cv.width = W * K; cv.height = H * K;
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
      if (!BUILT) { buildThreads(); buildCloth(); buildLight(); buildBack(); buildFront(); buildMotes(); BUILT = true; }
      built = true;
      const render = (t) => { drawFrame(t); present(g); };
      render(0);
      if (EXPORT) {
        const mo = new MutationObserver(() => { if (!built && document.documentElement.dataset.ready) delete document.documentElement.dataset.ready; });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ready'] });
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__theloom = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); render(t); window.__theloom.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-loom';
        api.ready();
      } else {
        window.__theloom = { duration: D, isReady: () => built, renderAt(t) { return new Promise((res) => { playing = false; clock = t; render(t); requestAnimationFrame(() => res()); }); } };
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
          if (window.__theloom) delete window.__theloom;
        },
      };
    },
  });
})();
