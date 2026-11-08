// Shot 7 (60.3-65.8): backlit near-white sky, tower seen from the dunes through grass,
// the ship descending vertically on its landing burn into the open arms.
(function () {
  'use strict';
  const { W, H, S, Wm, T, M, U, buf, P, Pd, rect, hl, vl, line, poly, disc, ring, pick, bth, mulberry, hash, vnoise,
    clamp, lerp, smooth, spline, ri, get } = PX;
  window.SHOTS = window.SHOTS || {};

  const SUN = [302, 40];
  const CX = 241;              // tower / ship axis
  const TOP = 96, BASE = 252;  // tower top & base row
  const AT = 62;               // top of the upright catch arms

  // ---------- sky ----------
  // warm-white core around the sun falling off to cool pale grey at the edges
  // banded: white-gold glare, peach, pale blue, rose at the far edges
  const skyRamp = [Wm[6], S[9], U[5], S[8], U[4]];
  const SKYC = new Set([Wm[6], S[9], U[5], S[8], U[4], T[8], T[7]]);
  function sky(t) {
    const drift = (t - 60.3) * 2.0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - SUN[0], dy = (y - SUN[1]) * 1.15;
        const d = Math.sqrt(dx * dx + dy * dy);
        let v = d < 34 ? 0.3 * d / 34 : 0.3 + 4.1 * (1 - Math.exp(-(d - 34) / 170));
        if (d > 26 && d < 70) v += 0.6 * Math.sin((d - 26) / 44 * Math.PI) * 0.0; // keep monotone
        // long combed cirrus: elongated noise along a gentle diagonal
        const u = x * 0.95 + y * 0.31 + drift, w = -x * 0.31 + y * 0.95 + 9 * Math.sin(u * 0.009);
        const n = PX.fbm2(u * 0.0105, w * 0.085, 21, 3);
        const m = smooth(60, 200, d);
        if (n > 0.6) v -= m * Math.min(0.8, (n - 0.6) * 5);
        else if (n < 0.36) v += m * 0.35;
        // bright haze settling over the dunes
        if (y > 200) v -= (y - 200) / 70 * 1.1;
        { const i0 = Math.floor(v), f0 = v - i0; v = i0 + clamp((f0 - 0.25) / 0.5, 0, 1); }
        buf[y * W + x] = pick(skyRamp, v, x, y);
      }
    }
  }

  // ---------- sun & glare (pixel shapes) ----------
  function sun(t) {
    const [sx, sy] = SUN;
    // faint warm halo (sparse dither) around a big white bloom
    disc(sx, sy, 14, Wm[6]);
    ring(sx, sy, 18, Wm[5], 0.3);
    // six slow, faint rays
    const rot = (t - 60.3) * 0.035;
    for (let k = 0; k < 8; k += 2) {
      const a = rot + k * Math.PI / 4 + 0.2;
      const len = 70 * (0.9 + 0.1 * Math.sin(t * 1.1 + k));
      for (let r = 17; r < len; r += 1) Pd(ri(sx + Math.cos(a) * r), ri(sy + Math.sin(a) * r), Wm[5], 0.6 * (1 - (r - 17) / (len - 17)), 0, 0);
    }
    for (let x = sx - 95; x <= sx + 95; x++) if (Math.abs(x - sx) > 15) Pd(x, sy, Wm[5], (1 - Math.abs(x - sx) / 95) * 0.75, 0, 0);
  }
  function hexPts(cx, cy, r, rot) {
    const p = [];
    for (let k = 0; k < 6; k++) { const a = rot + k * Math.PI / 3; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return p;
  }
  function hexOutline(cx, cy, r, c, level) {
    const p = hexPts(cx, cy, r, Math.PI / 6);
    for (let k = 0; k < 6; k++) { const a = p[k], b = p[(k + 1) % 6]; line(a[0], a[1], b[0], b[1], c, (x, y) => Pd(x, y, c, level, 0, 0)); }
  }
  function flare() {
    // ghosts on the sun's axis, kept in the open upper-right sky
    const [sx, sy] = SUN;
    ring(sx + 34, sy + 22, 3, Wm[4], 0.6);
    hexOutline(sx + 62, sy + 40, 7, Wm[4], 0.55);
    disc(sx + 62, sy + 40, 5, 0, (x, y) => Pd(x, y, Wm[5], 0.18, 0, 0));
    disc(sx + 84, sy + 54, 2, 0, (x, y) => Pd(x, y, Wm[4], 0.6, 0, 0));
    ring(sx - 28, sy - 18, 5, Wm[5], 0.45);
  }

  // ---------- tower (frontal, backlit, hazy) ----------
  const tc = { far: T[6], mem: T[4], mid: T[5], dk: T[3], rim: T[7], lt: T[6] };
  const X0 = 226, X1 = 255;
  function towerLattice() {
    const x0 = X0, x1 = X1;
    // far-face bracing through the openings (lighter: further into the haze)
    for (let y = TOP + 8; y < 176; y += 14) {
      line(229, y + 2, 238, y + 12, tc.far); line(243, y + 2, 252, y + 12, tc.far);
    }
    // near face: modules with X-bracing in two bays
    for (let y = TOP + 7; y < 176; y += 14) {
      hl(x0, x1, y, tc.mem); hl(x0 + 2, x1 - 2, y + 1, tc.mid);
      line(228, y + 1, 239, y + 13, tc.mid); line(239, y + 1, 228, y + 13, tc.mid);
      line(242, y + 1, 253, y + 13, tc.mid); line(253, y + 1, 242, y + 13, tc.mid);
      rect(233, y + 6, 2, 2, tc.mem); rect(247, y + 6, 2, 2, tc.mem); // gusset knots
    }
    // columns
    vl(x0, TOP, BASE, tc.dk); vl(x0 + 1, TOP, BASE, tc.mem);
    vl(240, TOP + 7, 176, tc.mem); vl(241, TOP + 7, 176, tc.mid);
    vl(x1 - 1, TOP, BASE, tc.mem); vl(x1, TOP, BASE, tc.rim);
    // clad lower section with panels
    for (let y = 176; y <= BASE; y++) for (let x = x0 + 2; x <= x1 - 2; x++) {
      const pr = Math.floor((y - 176) / 9), pc = Math.floor((x - 228) / 6);
      let c = hash(pr, pc, 77) > 0.72 ? tc.lt : tc.mid;
      if ((y - 176) % 9 === 0 && (x - 228) % 6 !== 3) c = tc.mem;
      if (x === 240 || x === 241) c = x === 240 ? tc.mem : tc.mid;
      buf[y * W + x] = c;
    }
    hl(x0, x1, 176, tc.dk);
    for (let y = 228; y <= BASE; y++) for (let x = x0; x <= x1; x++) Pd(x, y, T[6], (y - 228) / 40, 0, 0);
    // top cap
    rect(x0 - 1, TOP, x1 - x0 + 3, 7, tc.mid);
    hl(x0 - 1, x1 + 1, TOP, tc.mem); hl(x0 - 1, x1 + 1, TOP + 6, tc.dk);
    vl(x1 + 1, TOP, TOP + 6, tc.rim); vl(x0 - 1, TOP, TOP + 6, tc.dk);
    for (let x = x0 + 3; x <= x1 - 3; x += 4) vl(x, TOP + 2, TOP + 4, tc.mem);
    // plinth
    poly([[221, BASE], [261, BASE], [266, BASE + 10], [216, BASE + 10]], T[4]);
    hl(221, 261, BASE, T[5]); hl(218, 264, BASE + 4, T[3]);
  }
  // QD arm (left, mid height)
  function qdArm() {
    const y = 160;
    hl(199, 225, y, tc.mem); hl(199, 225, y + 1, tc.dk);
    for (let x = 200; x <= 224; x += 3) P(x, y - 2, tc.mem);
    hl(199, 225, y - 3, tc.mem);
    rect(197, y - 2, 3, 6, tc.dk);
    line(200, y + 3, 225, y + 15, tc.mem);
    for (let x = 205; x <= 221; x += 6) { const yb = y + 3 + ri((x - 200) * 12 / 25); vl(x, y + 2, yb, tc.mem); line(x, y + 2, x + 6, y + 3 + ri((x + 6 - 200) * 12 / 25), tc.mid); }
  }
  // carriage riding at the tower top, behind the ship
  function carriage() {
    const y0 = TOP - 3;
    rect(X0 + 1, y0, X1 - X0 - 1, 9, tc.mem);
    hl(X0 + 1, X1 - 1, y0, tc.dk); hl(X0 + 1, X1 - 1, y0 + 8, tc.dk);
    for (let x = X0 + 3; x < X1 - 1; x += 4) vl(x, y0 + 2, y0 + 6, tc.dk);
    vl(X1 - 1, y0, y0 + 8, tc.rim);
  }
  // the two chopsticks, open toward the camera: upright truss frames standing either side of the ship
  function arms(t) {
    const yb = TOP + 9;
    const frame = (xa, xb, outer, rimRight) => {
      // chords
      vl(xa, AT, yb, tc.dk); vl(xb, AT, yb, tc.dk);
      vl(xa + 1, AT + 1, yb, tc.mem); vl(xb - 1, AT + 1, yb, tc.mem);
      // zig-zag web
      for (let y = AT + 2; y < yb - 2; y += 6) { line(xa + 1, y, xb - 1, y + 3, tc.mem); line(xb - 1, y + 3, xa + 1, y + 6, tc.mem); }
      // catch rail on top, its pin block pointing at the ship
      hl(xa - 1, xb + 1, AT - 1, tc.dk); hl(xa - 1, xb + 1, AT, tc.mem);
      rect(rimRight ? xa - 2 : xb + 1, AT - 2, 2, 3, tc.dk);
      // gusset strut out to the tower corner
      line(outer, yb + 6, outer < xa ? xa : xb, AT + 12, tc.mem);
      line(outer, yb + 7, outer < xa ? xa : xb, AT + 13, tc.dk);
      hl(xa, xb, ri((AT + yb) / 2), tc.dk);
      if (rimRight) { vl(xb + 0, AT, yb, tc.rim); hl(xa, xb, AT - 1, tc.rim); }
    };
    frame(222, 228, X0 - 4, false);
    frame(253, 259, X1 + 4, true);
  }

  // ---------- ship ----------
  const tipY = spline([[60.3, -70], [61.0, -40], [62.0, -14], [63.0, 3], [64.0, 13], [65.0, 20], [65.8, 25]]);
  const L = 66, RR = 8, LN = 18;
  const prof = s => Math.pow(1 - Math.pow(1 - clamp(s, 0, 1), 2), 0.55);
  function ship(t) {
    const ty = ri(tipY(t));
    for (let k = 0; k < L; k++) {
      const y = ty + k; if (y < 0 || y >= H) continue;
      const hw = k < LN ? Math.max(1, RR * prof((k + 0.7) / LN)) : RR;
      const xl = ri(CX - hw), xr = ri(CX + hw) - 1;
      for (let x = xl; x <= xr; x++) {
        const u = (x + 0.5 - CX) / hw;
        let c = u < -0.35 ? T[4] : u < 0.15 ? T[6] : u < 0.55 ? T[7] : T[8];
        if (u < -0.35 && k > LN && k % 4 === 0) c = T[3];   // heat-shield tile rows
        if (k < LN * 0.42) c = u > 0.3 ? T[6] : T[4];                  // tiled nose cap
        if (x === xl) c = T[3];
        if (x === xr) c = T[8];
        if (x === xr - 1 && k > LN * 0.5 && (k & 1)) c = U[5]; // the peach sky caught on the steel
        if (k === L - 1) c = T[3];
        buf[y * W + x] = c;
      }
      // weld rings (faint)
      if (k > LN && (k - LN) % 12 === 6) for (let x = xl + 1; x < xr - 1; x++) Pd(x, y, T[4], 0.5, 0, 0);
    }
    // forward flaps
    for (let k = 14; k <= 27; k++) {
      const y = ty + k, wdt = k < 17 ? 1 : k < 25 ? 3 : 2;
      for (let i = 1; i <= wdt; i++) { P(CX - RR - i, y, T[3]); P(CX + RR - 1 + i, y, i === wdt ? T[7] : T[3]); }
    }
    // aft flaps
    for (let k = L - 15; k < L; k++) {
      const y = ty + k, wdt = k < L - 12 ? 2 : 4;
      for (let i = 1; i <= wdt; i++) { P(CX - RR - i, y, T[3]); P(CX + RR - 1 + i, y, i === wdt ? T[7] : T[3]); }
    }
    // catch hardpoints just under the forward flaps
    P(CX - RR - 1, ty + 30, T[3]); P(CX - RR - 1, ty + 31, T[3]); P(CX + RR, ty + 30, T[3]); P(CX + RR, ty + 31, T[7]);
    return ty + L;
  }
  // landing-burn plume, throttling down as the ship slows
  function plume(t, yb) {
    const v = (tipY(t + 0.05) - tipY(t - 0.05)) / 0.1;
    const thr = clamp(0.35 + v / 60, 0.35, 1.1);
    const f = Math.floor(t * 30);
    const len = ri(10 + 14 * thr + 3 * hash(f, 1, 7));
    for (let k = 0; k < len; k++) {
      const y = yb + k, q = k / len;
      const hw = q < 0.15 ? lerp(3.0, 4.2, q / 0.15) : lerp(4.2, 0.8, (q - 0.15) / 0.85);
      for (let x = ri(CX - hw); x <= ri(CX + hw) - 1; x++) {
        const e = Math.abs(x + 0.5 - CX) / hw;
        let c = q < 0.35 ? (e < 0.5 ? Wm[6] : e < 0.8 ? Wm[4] : Wm[3]) : q < 0.7 ? (e < 0.45 ? Wm[5] : Wm[3]) : Wm[2];
        if (q > 0.7) { Pd(x, y, c, 1 - (q - 0.7) / 0.3, 0, 0); continue; }
        P(x, y, c);
      }
      if (k === 5 || k === 10 || k === 15) { P(CX - 2, y, Wm[6]); P(CX - 1, y, Wm[6]); P(CX, y, Wm[6]); P(CX + 1, y, Wm[6]); }
    }
    // warm glow haloing the flame
    disc(CX, yb + len * 0.4, len * 0.55 + 3, 0, (x, y, dx, dy) => { const g = get(x, y); if (g === S[9] || g === T[8] || g === S[8] || g === T[7]) Pd(x, y, Wm[5], 0.45 * (1 - Math.hypot(dx, dy * 0.8) / (len * 0.55 + 3)), 0, 0); });
    // exhaust glow column washing down the tower face
    for (let y = yb + len; y < yb + len + 30; y++) {
      const q = (y - yb - len) / 30;
      for (let x = CX - 3; x <= CX + 2; x++) Pd(x, y, Wm[5], (1 - q) * 0.55 * (1 - Math.abs(x + 0.5 - CX) / 4), 0, 0);
    }
    return len;
  }
  // heat shimmer: wobble short row segments under the plume
  function shimmer(t, x0, x1, y0, y1) {
    const row = new Uint8Array(x1 - x0 + 1);
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
      const o = ri(Math.sin(t * 23 + y * 0.9) * 0.9 * (1 - (y - y0) / (y1 - y0 + 1)));
      if (!o) continue;
      for (let x = x0; x <= x1; x++) row[x - x0] = buf[y * W + clamp(x - o, 0, W - 1)];
      for (let x = x0; x <= x1; x++) buf[y * W + x] = row[x - x0];
    }
  }

  // ---------- birds ----------
  const BIRD = [
    ['X...X', '.X.X.', '..X..'],
    ['.....', 'XX.XX', '..X..'],
    ['.....', '.XXX.', 'X.X.X'],
  ];
  function bird(x, y, fr, c) {
    const s = BIRD[fr];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) if (s[j][i] === 'X') P(x + i - 2, y + j - 1, c);
  }
  function birds(t) {
    const dt = t - 60.3;
    const list = [[96, 132, 21, 0], [80, 141, 19, 0.37], [70, 128, 23, 0.71]];
    for (const [x0, y0, vx, ph] of list) {
      const x = ri(x0 + vx * dt), y = ri(y0 - dt * 1.6 + Math.sin(dt * 1.7 + ph * 6) * 1.5);
      const cyc = (dt * 3.1 + ph) % 1.6;
      const fr = cyc < 0.3 ? 0 : cyc < 0.55 ? 1 : cyc < 0.85 ? 2 : 1; // flap, then glide
      bird(x, y, fr, T[4]);
    }
  }

  // ---------- grass ----------
  const ground = x => 254 + 2 * Math.sin(x * 0.031) + 1.5 * Math.sin(x * 0.077 + 1);
  const gs = (x, c, w) => Math.exp(-((x - c) / w) * ((x - c) / w));
  const clumpH = x => 10 + 22 * gs(x, 50, 45) + 12 * gs(x, 160, 34) + 6 * gs(x, 250, 40) +
    32 * gs(x, 345, 45) + 44 * gs(x, 432, 40) + 38 * gs(x, 485, 26);
  const BLADES = [];
  (function genBlades() {
    const r = mulberry(7031);
    // back layer: hazy, short
    for (let i = 0; i < 360; i++) { const x = r() * 490 - 5; BLADES.push({ L: 0, x, h: 4 + r() * 8 + clumpH(x) * 0.35, lean: (r() - 0.5) * 0.5, bend: (r() - 0.4) * 0.6, ph: r() * 6 }); }
    // mid layer: backlit tufts
    for (let i = 0; i < 900; i++) { const x = r() * 490 - 5; BLADES.push({ L: 1, x, h: (3 + r() * 10 + clumpH(x) * (0.55 + r() * 0.6)), lean: (r() - 0.5) * 0.9, bend: (r() - 0.35) * 1.1, ph: r() * 6 }); }
    // front layer: dark, low
    for (let i = 0; i < 520; i++) { const x = r() * 490 - 5; BLADES.push({ L: 2, x, h: 4 + r() * 12 + clumpH(x) * 0.25, lean: (r() - 0.5) * 1.0, bend: (r() - 0.5) * 0.8, ph: r() * 6 }); }
  })();
  const STALKS = [];
  (function genStalks() {
    const r = mulberry(99);
    const xs = [4, 13, 31, 47, 58, 84, 101, 122, 452];
    for (const x of xs) STALKS.push({ x: x + r() * 4, h: x > 200 ? 52 : 46 + r() * 64, lean: (r() - 0.5) * 0.22, ph: r() * 6, sp: 4 + ri(r() * 1.6) });
  })();
  function wind(t, x) {
    return 1.0 * Math.sin(t * 1.9 + x * 0.045) + 0.55 * Math.sin(t * 3.4 + x * 0.13 + 2) +
      1.8 * smooth(0.5, 1, Math.sin(t * 0.85 - x * 0.012));
  }
  const bladeCols = [
    { base: M[3], mid: M[4], tip: M[5] },                 // back: hazy straw
    { base: M[0], mid: M[1], tip: M[4], rim: Wm[4] },     // mid: backlit, dark with glowing tips
    { base: M[0], mid: M[1], tip: M[2] },                 // front: dark silhouettes
  ];
  const russet = { base: M[0], mid: Wm[0], tip: M[4], rim: Wm[4] };
  const olive = { base: M[1], mid: M[4], tip: M[5], rim: Wm[4] };
  function blade(b, t) {
    const by = ri(ground(b.x)) + (b.L === 2 ? 12 : b.L === 1 ? 4 : 0);
    const h = ri(b.h);
    let cs = bladeCols[b.L];
    if (b.L === 1) { const q = (b.ph * 1000) % 1; cs = q < 0.45 ? olive : cs; }
    const w = wind(t, b.x) * (b.L === 0 ? 0.6 : 1) + Math.sin(t * 2.3 + b.ph) * 0.35;
    let px = ri(b.x), py = by;
    for (let k = 1; k <= h; k++) {
      const f = k / h;
      const x = ri(b.x + b.lean * k + b.bend * f * f * h * 0.5 + w * f * f * (h / 14));
      const y = by - k;
      const c = f < 0.4 ? cs.base : f < 0.85 ? cs.mid : cs.tip;
      line(px, py, x, y, c);
      px = x; py = y;
    }
    if (cs.rim && h > 10 && hash(ri(b.x * 7), 3, 11) > 0.72) P(px, py, cs.rim);
  }
  // sea-oat stalk: thin stem, alternating seed spikelets, rim-lit from the sun side (right)
  // sea oats: a thin stem that nods over at the top, carrying a loose panicle of flat,
  // drooping spikelets on short pedicels; straw-coloured, rim-lit from the sun side (right)
  const SPK = [  // flat spikelet, hanging from its top pixel; 0 dark edge, 1 body, 2 lit, 3 tip
    ['.0.', '012', '012', '012', '.1.'],
    ['.0.', '012', '012', '.1.'],
    ['0.', '12', '.1'],
  ];
  function spikelet(x, y, size, rim) {
    const sp = SPK[size], col = [M[1], M[4], M[5], M[4]];
    for (let j = 0; j < sp.length; j++) for (let i = 0; i < sp[j].length; i++) {
      const ch = sp[j][i];
      if (ch !== '.') P(x + i - 1, y + j, col[+ch]);
    }
    if (rim) P(x + sp[0].length - 2, y + 1, Wm[4]);
  }
  function stalk(s, t) {
    const by = ri(ground(s.x)) + 6, h = ri(s.h);
    const sway = wind(t, s.x) * 1.2 + Math.sin(t * 1.4 + s.ph) * 0.7;
    const nod = s.ph > 3 ? 1 : -1;
    const pts = [];
    for (let k = 0; k <= h; k++) {
      const f = k / h;
      pts.push([ri(s.x + s.lean * k + sway * f * f * (h / 24) + nod * h * 0.16 * f * f * f), by - ri(k * (1 - 0.1 * f * f * f))]);
    }
    for (let k = 1; k < pts.length; k++) line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], M[1]);
    // panicle: spikelets hang on pedicels from the upper part of the stem
    const k0 = ri(h * 0.58);
    const dangle = ri(sway * 0.35);
    let side = nod;
    for (let k = k0, n = 0; k <= h; k += 4, n++) {
      const [x, y] = pts[Math.min(k, h)];
      const g = (k - k0) / (h - k0 + 1);   // 0 at the base of the panicle, 1 at the nodding tip
      const reach = side === nod ? 3 : 2;
      const ex = x + side * reach + dangle, ey = y + 1;
      line(x, y, ex, ey, M[2]);
      spikelet(ex, ey, g < 0.45 ? 0 : g < 0.8 ? 1 : 2, side > 0 && hash(k, ri(s.x), 5) > 0.4);
      side = (n % 3 === 2) ? side : -side;
    }
    // the nodding tip spikelet
    const [tx, ty] = pts[h];
    spikelet(tx + nod + dangle, ty + 1, 1, nod > 0);
    // a long leaf curling from the base
    let px = ri(s.x), py = by;
    for (let k = 1; k <= 22; k++) {
      const f = k / 22;
      const x = ri(s.x + (s.ph > 3 ? 1 : -1) * (k * 0.5 + f * f * 9) + sway * f * f * 1.5), y = by - ri(k * (1 - f * 0.45));
      line(px, py, x, y, f < 0.6 ? M[1] : M[2]); px = x; py = y;
    }
  }
  function grass(t) {
    // distant ground band behind the grass
    for (let x = 0; x < W; x++) {
      const g = ri(ground(x));
      for (let y = g - 1; y < H; y++) buf[y * W + x] = y < g + 2 ? M[3] : y < g + 5 ? M[2] : M[1];
      // dense thatch mass behind the blades so no sky peeks through low down
      const top = ri(g - 3 - clumpH(x) * 0.42 - 2 * Math.sin(x * 0.21) - 1.5 * Math.sin(x * 0.53));
      for (let y = top; y < g + 4; y++) buf[y * W + x] = y < top + 2 ? M[3] : y < top + 6 ? M[2] : M[1];
    }
    for (const b of BLADES) if (b.L === 0) blade(b, t);
    for (const b of BLADES) if (b.L === 1) blade(b, t);
    for (const s of STALKS) stalk(s, t);
    for (const b of BLADES) if (b.L === 2) blade(b, t);
    // bottom filled dark
    for (let y = 266; y < H; y++) for (let x = 0; x < W; x++) if (hash(x, y, 2) > 0.25) buf[y * W + x] = M[0];
  }
  // pollen motes glinting over the dark grass
  function motes(t) {
    for (let i = 0; i < 26; i++) {
      const x0 = hash(i, 1, 41) * 520 - 20, y0 = 180 + hash(i, 2, 41) * 85;
      const x = ri(((x0 + (t - 60.3) * (6 + hash(i, 3, 41) * 8)) % 500 + 500) % 500 - 10);
      const y = ri(y0 - (t - 60.3) * 1.5 + Math.sin(t * 1.3 + i) * 3);
      const c = get(x, y);
      if (c === M[0] || c === M[1] || c === M[2]) {
        const tw = Math.sin(t * 5 + i * 2.1);
        P(x, y, tw > 0.2 ? Wm[5] : Wm[4]);
      }
    }
  }

  window.SHOTS.shot7 = function (t) {
    sky(t);
    // the ringed planet low in the east (screen right here), pale through the dune haze
    SUR.planet(418, 196, 64, { tilt: -0.28, flat: 0.22, alpha: 1, hazeY: 236, hazeLen: 70, light: [-0.75, -0.55] });
    SUR.moon2(96, 34, 4.5, 1);
    sun(t);
    SUR.motes(t, 16, 13, 0, 0, W, 200, 4, -2, [Wm[4], U[6], U[4]], c => SKYC.has(c));
    towerLattice();
    qdArm();
    carriage();
    const yb = ship(t);
    const len = plume(t, yb);
    arms(t);
    shimmer(t, CX - 9, CX + 8, yb + len - 2, yb + len + 26);
    // warm work lamps on the tower, a slow beacon on the arm tops
    for (const y of [117, 145, 173]) { P(X0, y, Wm[4]); P(X1, y, Wm[4]); }
    if (((t - 60.3) % 1.4) < 0.3) { P(225, AT - 3, Wm[3]); P(256, AT - 3, Wm[3]); }
    birds(t);
    grass(t);
    motes(t);
    flare();
  };
})();
