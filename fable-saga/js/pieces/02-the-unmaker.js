/* The Unmaker — Fable Saga, part III.
 *
 * A two-minute pixel-art action short. The Null was only a shadow: at dawn, above the clouds, the sky tears open and
 * the thing that made it comes through. Every frame is a pure function of t, drawn into a 480 × 270 indexed buffer in
 * 96 colours and shown at 4×; the film is cut as a sequence of shots, each with its own camera, with captions on top.
 * Built from the parts in fable-saga/production/part3/src. An unofficial fan concept, not affiliated with Anthropic.
 */
(function () {
  'use strict';
  /* ================================================================ constants & helpers */
  const W = 480, H = 270, NP = W * H, D = 120;
  const TAU = Math.PI * 2, PI = Math.PI, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const lin = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
  const frac = (x) => x - Math.floor(x);
  const eoc = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const eic = (u) => Math.pow(clamp(u, 0, 1), 3);
  const eio = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const eob = (u) => { u = clamp(u, 0, 1); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
  const SEED = 23;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function vn(x, y, c, s) {
    const gx = x / c, gy = y / c, i = fl(gx), j = fl(gy), fx = gx - i, fy = gy - j;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(ih(i, j, s), ih(i + 1, j, s), ux), lerp(ih(i, j + 1, s), ih(i + 1, j + 1, s), ux), uy);
  }
  function fbm(x, y, c, oct, s) { let v = 0, a = 1, n = 0; for (let k = 0; k < oct; k++) { v += a * vn(x, y, c, s + k * 31); n += a; a *= 0.5; c *= 0.5; } return v / n; }
  const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);
  const bay = (x, y) => B8[((y & 7) << 3) | (x & 7)];

  /* ================================================================ palette (64) */
  const PAL_HEX = [
    '000000', '07060d', '0e0c1a', '171530', '221f48', '2f2b63', '3f3a80', '524ca0', '6c64bd',     // 0-8 night and sky violets
    '2a0f1f', '4a1426', '7a1e2c', 'b0322f', 'e0582f', 'f28c3a', 'ffc060', 'ffe9a8',               // 9-16 dusk fire
    '3a3550', '5a5370', '8a83a0', 'c4bfd6', 'eceaf4', 'ffffff',                                   // 17-22 cloud and light
    '0e1f1a', '18352a', '26503a', '3a7048',                                                       // 23-26 forest
    '201814', '3a2a20', '5a4030', '7c5a40', 'a07a58',                                             // 27-31 earth and rock
    '4a4a52', '6c6c74', '9a9aa2',                                                                 // 32-34 stone
    'd97757', 'a8553b', 'f2a585', '6e2a1a',                                                       // 35-38 hero coral
    '141218', '24202c', '3a3444', 'ff2a4a', 'a0102a', 'ff8aa0',                                   // 39-44 the Null
    '1f66bd', '3f98f2', '95d4ff', '3a952c', '7bd23e', 'c8f27c', 'cf9c17', 'ffd84a', 'fff4b0',     // 45-53 water, leaf, lightning
    '4a1d80', '7c3ccc', 'ad78ff', 'e0c8ff',                                                       // 54-57 starlight
    'ffb020', 'ffe066', 'fffbe0', '30e0ff', '5a2a8a', '120c24',                                   // 58-63 gold aura, electric cyan, deep violets
    'f4efe6', 'd8d0c4', 'b3a998', '857a6c', '4e463e', '2a2420',                                   // 64-69 porcelain (the Unmaker's mask)
    '3a0030', '6a0050', 'a8007a', 'e01aa8', 'ff5ad0', 'ffb0ec',                                   // 70-75 magenta (its eyes and magic)
    '050008', '0c0418', '16082c', '220c3e', '2e1050',                                             // 76-80 void
    'ff3040', 'ff9020', 'fff040', '40ff80', '30d0ff', '5060ff', 'c040ff',                         // 81-87 prism
    '0a3a6a', '1a7ad0', '60c8ff', 'e8faff',                                                       // 88-91 storm
    '1c1c20', '3a3a40', '6a6a72', 'a8a8b0',                                                       // 92-95 drained grey
  ];
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  const NPAL = PAL.length;
  const EL = [[45, 46, 47, 22], [48, 49, 50, 22], [51, 52, 53, 22], [54, 55, 56, 57]]; // element ramps: dark, mid, bright, pale
  const GOLD = [58, 59, 60, 22], RED = [43, 42, 44, 22], CORAL = 35, CORD = 36, CORL = 37;
  function nearest(r, g, b) {
    let best = 0, bd = 1e18;
    for (let k = 0; k < NPAL; k++) {
      const p = PAL[k], rm = (p[0] + r) / 2, dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  // tint tables: 8 levels of mixing (or adding) a colour into every palette entry
  function mkTab(hex, add) {
    const q = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)], T = [];
    for (let lv = 0; lv <= 8; lv++) {
      const a = lv / 8, tab = new Uint8Array(256);
      for (let i = 0; i < NPAL; i++) {
        const p = PAL[i];
        tab[i] = lv === 0 ? i : add ? nearest(Math.min(255, p[0] + q[0] * a), Math.min(255, p[1] + q[1] * a), Math.min(255, p[2] + q[2] * a))
          : nearest(lerp(p[0], q[0], a), lerp(p[1], q[1], a), lerp(p[2], q[2], a));
      }
      T.push(tab);
    }
    return T;
  }
  const T_DARK = mkTab('000000', false), T_WH = mkTab('ffffff', true), T_RED = mkTab('ff2040', true), T_GOLD = mkTab('ffc040', true);
  const T_BL = mkTab('3f98f2', true), T_GR = mkTab('6cc040', true), T_YE = mkTab('ffd84a', true), T_VI = mkTab('9a5cf0', true);
  const T_NIGHT = mkTab('120c24', false), T_CRIM = mkTab('5a0a1c', false), T_WARM = mkTab('ffb060', true);
  const EL_T = [T_BL, T_GR, T_YE, T_VI];

  /* ================================================================ buffer & primitives */
  const BUF = new Uint8Array(NP);
  function P(x, y, c) { x = fl(x); y = fl(y); if (x >= 0 && x < W && y >= 0 && y < H) BUF[y * W + x] = c; }
  function rectF(x, y, w, h, c) {
    const x0 = Math.max(0, fl(x)), y0 = Math.max(0, fl(y)), x1 = Math.min(W, fl(x + w)), y1 = Math.min(H, fl(y + h));
    if (!(x1 > x0) || !(y1 > y0)) return;            // (an empty or off-screen box; a negative end would make fill() wrap)
    for (let yy = y0; yy < y1; yy++) BUF.fill(c, yy * W + x0, yy * W + x1);
  }
  function lineF(x0, y0, x1, y1, fn) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, L = Math.max(dx, -dy) || 1;
    let e = dx + dy, n = 0;
    for (;;) {
      fn(x0, y0, n / L);
      if ((x0 === x1 && y0 === y1) || ++n > 3000) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  const lineP = (x0, y0, x1, y1, c) => lineF(x0, y0, x1, y1, (x, y) => P(x, y, c));
  function thick(x0, y0, x1, y1, w, c) { for (let k = 0; k < w; k++) for (let j = 0; j < w; j++) lineP(x0 + k - w / 2, y0 + j - w / 2, x1 + k - w / 2, y1 + j - w / 2, c); }
  function discF(cx, cy, r, c) {
    const r2 = r * r, y0 = Math.max(0, fl(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r)), x0 = Math.max(0, fl(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r2) BUF[y * W + x] = c; }
  }
  function ring(cx, cy, r, ry, c, keep) { for (let a = 0; a < TAU; a += 0.6 / Math.max(4, r)) { const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * (ry === undefined ? r : ry); if (!keep || keep(x, y, a)) P(x, y, c); } }
  function tintI(i, x, y, T, a) {
    let lv = (a * 8 + 0.5 + (bay(x, y) - 0.5) * 0.6) | 0;
    if (lv <= 0) return;
    if (lv > 8) lv = 8;
    BUF[i] = T[lv][BUF[i]];
  }
  function tintP(x, y, T, a) { x = fl(x); y = fl(y); if (x >= 0 && x < W && y >= 0 && y < H) tintI(y * W + x, x, y, T, a); }
  function tintAll(T, a) { if (a <= 0.004) return; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tintI(y * W + x, x, y, T, a); }
  function glow(cx, cy, r, T, amax, pw) {
    if (amax <= 0.004 || r <= 0) return;
    const y0 = Math.max(0, fl(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r)), x0 = Math.max(0, fl(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), ir = 1 / r;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) * ir;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) * ir, d = dx * dx + dy * dy;
        if (d >= 1) continue;
        const f = 1 - Math.sqrt(d);
        tintI(y * W + x, x, y, T, amax * (pw === 1 ? f : f * f));
      }
    }
  }
  function sparkle(x, y, L, c0, c1) {
    x = Math.round(x); y = Math.round(y);
    if (L < 0.5) return;
    P(x, y, c0);
    const l = Math.round(L);
    for (let k = 1; k <= l; k++) { const c = k <= l * 0.45 ? c0 : c1; P(x + k, y, c); P(x - k, y, c); P(x, y + k, c); P(x, y - k, c); }
    if (l >= 3) { const d = Math.max(1, Math.round(l * 0.3)); for (let k = 1; k <= d; k++) { P(x + k, y + k, c1); P(x - k, y - k, c1); P(x + k, y - k, c1); P(x - k, y + k, c1); } }
  }

  /* ================================================================ lettering: a 5 × 7 font for captions and shouts */
  const FONT = {
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'], J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
    K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'], X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], 1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
    2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], 5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '.': ['..', '..', '..', '..', '..', '##', '##'], ',': ['..', '..', '..', '..', '..', '.#', '#.'], '!': ['#', '#', '#', '#', '#', '.', '#'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'], "'": ['#', '#', '.', '.', '.', '.', '.'],
    '-': ['...', '...', '...', '###', '...', '...', '...'], ':': ['.', '#', '.', '.', '.', '#', '.'], '·': ['.', '.', '.', '#', '.', '.', '.'],
    ' ': ['...', '...', '...', '...', '...', '...', '...'],
  };
  const glyphW = (ch) => (FONT[ch] || FONT[' '])[0].length;
  function textWidth(s, sc) { let w = 0; for (const ch of s) w += (glyphW(ch) + 1) * sc; return w - sc; }
  // draw text; vis(k) gives how many glyphs are visible (typewriter); outline colour oc
  function text(s, x, y, c, sc, oc, nvis, shake) {
    sc = sc || 1;
    let cx = x, k = 0;
    for (const ch of s) {
      if (nvis !== undefined && k >= nvis) break;
      const g = FONT[ch] || FONT[' '], gw = g[0].length;
      const jx = shake ? Math.round((ih(k, fl(shake * 30), 77) - 0.5) * 2) : 0, jy = shake ? Math.round((ih(k, fl(shake * 30), 78) - 0.5) * 2) : 0;
      if (oc !== undefined) for (let j = 0; j < 7; j++) for (let i = 0; i < gw; i++) if (g[j][i] === '#') { const ow = sc > 2 ? Math.max(1, Math.round(sc * 0.5)) : sc; rectF(cx + i * sc - ow + jx, y + j * sc - ow + jy, sc + ow * 2, sc + ow * 2, oc); }
      for (let j = 0; j < 7; j++) for (let i = 0; i < gw; i++) if (g[j][i] === '#') rectF(cx + i * sc + jx, y + j * sc + jy, sc, sc, typeof c === 'function' ? c(i, j, k) : c);
      cx += (gw + 1) * sc; k++;
    }
  }

  /* ================================================================ characters: drawn small, stamped at any scale and angle */
  const SW = 120, SH = 84, SOX = 60, SOY = 46;            // local sprite canvas, origin at the body centre
  const SPR = new Uint8Array(SW * SH), SPK = new Uint8Array(SW * SH); // colour + 1; class: 1 body, 2 sword, 4 outline
  const LBB = [0, 0, 0, 0];
  function sp(x, y, c, k) {
    x = Math.round(x); y = Math.round(y);
    const X = x + SOX, Y = y + SOY;
    if (X < 0 || Y < 0 || X >= SW || Y >= SH) return;
    SPR[Y * SW + X] = c + 1; SPK[Y * SW + X] = k || 1;
    if (x < LBB[0]) LBB[0] = x; if (y < LBB[1]) LBB[1] = y; if (x > LBB[2]) LBB[2] = x; if (y > LBB[3]) LBB[3] = y;
  }
  function spRect(x, y, w, h, c, k) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) sp(x + i, y + j, c, k); }
  // the sword, rasterised at an angle about the hand: u along the blade, v across
  function spSword(px, py, ang, cols) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let dy = -34; dy <= 34; dy++) for (let dx = -34; dx <= 34; dx++) {
      const fx = dx + 0.5, fy = dy + 0.5, u = fx * ca + fy * sa, v = -fx * sa + fy * ca, av = Math.abs(v);
      let c = -1;
      if (u >= -6 && u < -4.5 && av <= 1.4) c = 58;                          // pommel
      else if (u >= -4.5 && u < 0.5 && av <= 1.0) c = 38;                    // grip
      else if (u >= 0.5 && u < 2.5 && av <= 4.2) c = av > 3.2 ? 51 : 58;     // guard
      else if (u >= 2.5 && u < 30) {
        const tw = u > 25 ? (30 - u) * 0.36 : 1.8;
        if (av <= tw) c = cols ? (v < -0.6 ? 22 : cols[fl(frac(u * 0.08) * cols.length)]) : (v < -0.7 ? 22 : u < 5 ? 33 : 34);
      }
      if (c >= 0) sp(px + dx, py + dy, c, 2);
    }
  }
  // o: who ('hero' | 'null'), eyes, mouth, sword (angle or null), swordCols, legs (lift per leg), sq (squash: + wide, − tall)
  const FORMS = { storm: [90, 89, 91, 91], grey: [94, 93, 95, 92], zenith: [60, 59, 22, 22] };
  function buildSprite(o) {
    SPR.fill(0); SPK.fill(0); LBB[0] = 1e9; LBB[1] = 1e9; LBB[2] = -1e9; LBB[3] = -1e9;
    const sq = o.sq || 0, bw = Math.round(26 * (1 + sq * 0.5) / 2) * 2, bh = Math.max(10, Math.round(16 * (1 - sq * 0.4)));
    const x0 = -bw / 2, y0 = -Math.round(bh / 2), y1 = y0 + bh;
    const N = o.who === 'null';
    // the hero's forms recolour it: storm (electric blue), grey (drained of every element), zenith (white-gold, prism-edged)
    const F = FORMS[o.form] || null;
    const body = N ? 40 : F ? F[0] : CORAL, dark = N ? 39 : F ? F[1] : CORD, lite = N ? 41 : F ? F[2] : CORL;
    // legs
    const lift = o.legs || [0, 0, 0, 0], lh = o.fly ? 4 : 6;
    const lx = [x0, x0 + Math.round(bw * 0.2), x0 + bw - Math.round(bw * 0.2) - 4, x0 + bw - 4];
    for (let k = 0; k < 4; k++) spRect(lx[k], y1, 4, Math.max(1, lh - lift[k]), k === 0 || k === 2 ? body : body, 1);
    // body with a little shading (flat, as in the reference, just a lit top edge and a darker base)
    spRect(x0, y0, bw, bh, body, 1);
    for (let i = 0; i < bw; i++) { sp(x0 + i, y1 - 1, dark, 1); if (o.shade) sp(x0 + i, y0, lite, 1); }
    // arms
    const ay = y0 + Math.round(bh * 0.34), ah = Math.max(3, Math.round(bh * 0.32)), ar = Math.round(o.reach || 0);
    spRect(x0 - 4, ay, 4, ah, body, 1); spRect(x0 + bw, ay, 4 + ar, ah, body, 1);
    if (N) { // claws, and a jagged crown
      for (const s of [-1, 1]) { const ax = s < 0 ? x0 - 5 : x0 + bw + 4 + ar; sp(ax, ay, body, 1); sp(ax + s, ay - 1, 42, 1); sp(ax, ay + ah - 1, body, 1); sp(ax + s, ay + ah, 42, 1); }
      for (const [cx, h] of [[x0 + 5, 4], [0, 7], [x0 + bw - 6, 4]]) for (let j = 0; j < h; j++) { const w = Math.max(0, Math.round((h - j) * 0.45)); for (let i = -w; i <= w; i++) sp(cx + i, y0 - 1 - j, j > h - 3 ? 42 : 39, 1); }
      for (let i = 0; i < bw; i += 3) sp(x0 + i + (ih(i, 1, 41) < 0.5 ? 1 : 0), y0 + 2 + fl(ih(i, 2, 41) * (bh - 4)), 41, 1); // glitch flecks
    }
    // eyes
    const ex0 = x0 + Math.round(bw * 0.17), ex1 = x0 + bw - Math.round(bw * 0.17) - 2, ey = y0 + Math.round(bh * 0.28);
    const EC = N ? 42 : 0, e = o.eyes || 'normal';
    const eye = (ex, side) => {
      if (e === 'closed') { spRect(ex, ey + 2, 2, 1, EC, 1); return; }
      if (e === 'glow') { spRect(ex - 1, ey - 1, 4, 5, o.form === 'storm' ? 61 : o.form === 'zenith' ? 84 : 59, 1); spRect(ex, ey, 2, 3, 22, 1); return; }
      if (e === 'wide') { spRect(ex - 1, ey - 1, 3, 4, EC, 1); sp(ex - 1, ey - 1, 22, 1); return; }
      if (e === 'narrow') { spRect(ex, ey + 1, 2, 2, EC, 1); return; }
      spRect(ex, ey, 2, 3, EC, 1);
      if (e === 'angry' || N) { const inner = side < 0 ? ex + 1 : ex; sp(inner + side * -1, ey - 1, N ? 42 : 0, 1); sp(inner + side * -1 + (side < 0 ? 1 : -1), ey - 2, N ? 42 : 0, 1); sp(ex + (side < 0 ? 0 : 1), ey, body, 1); }
    };
    eye(ex0, -1); eye(ex1, 1);
    if (o.mouth) { const mw = o.mouth > 1 ? 8 : 4, mh = o.mouth > 1 ? 4 : 2; spRect(-mw / 2, ey + 5, mw, mh, N ? 42 : 0, 1); if (N) for (let i = -mw / 2; i < mw / 2; i += 2) sp(i, ey + 5, 39, 1); else if (o.mouth > 1) spRect(-mw / 2 + 1, ey + 5 + mh - 1, mw - 2, 1, 36, 1); }
    // sword on the right arm nub
    if (o.sword !== undefined && o.sword !== null) spSword(x0 + bw + 2 + ar, ay + ah / 2 - 0.5, o.sword, o.swordCols || null);
    // outline
    const oc = o.outline !== undefined ? o.outline : N ? 42 : F ? F[3] : 22, prism = o.form === 'zenith', pf = fl(T_NOW * 12);
    const src = SPR.slice();
    for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
      const i = y * SW + x; if (src[i]) continue;
      if (src[i - 1] || src[i + 1] || src[i - SW] || src[i + SW]) { SPR[i] = (SPK[i - 1] === 2 || SPK[i + 1] === 2 || SPK[i - SW] === 2 || SPK[i + SW] === 2 ? (N ? 42 : 1) : prism ? 81 + ((((x + y) >> 1) + pf) % 7) : oc) + 1; SPK[i] = 4; }
    }
    LBB[0]--; LBB[1]--; LBB[2]++; LBB[3]++;
    return { bw, bh, hand: [x0 + bw + 2 + ar, ay + ah / 2], top: y0, bottom: y1 + lh };
  }
  // stamp the built sprite at screen (x, y), scale S, angle (radians), mirrored if flip
  const SMASK = new Uint8Array(NP), SMB = [0, 0, 0, 0];
  function stamp(x, y, S, ang, flip, opt) {
    opt = opt || {};
    const ca = Math.cos(ang), sa = Math.sin(ang);
    let R = 0;
    for (const [lx, ly] of [[LBB[0], LBB[1]], [LBB[2] + 1, LBB[1]], [LBB[0], LBB[3] + 1], [LBB[2] + 1, LBB[3] + 1]]) R = Math.max(R, Math.hypot(lx, ly));
    R = R * S + 2;
    const x0 = Math.max(0, fl(x - R)), x1 = Math.min(W - 1, Math.ceil(x + R)), y0 = Math.max(0, fl(y - R)), y1 = Math.min(H - 1, Math.ceil(y + R));
    if (!opt.keepMask) { SMB[0] = W; SMB[1] = H; SMB[2] = -1; SMB[3] = -1; }
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
      const dx = X + 0.5 - x, dy = Y + 0.5 - y;
      let lx = (dx * ca + dy * sa) / S;
      const ly = (-dx * sa + dy * ca) / S;
      if (flip) lx = -lx;
      const ix = fl(lx) + SOX, iy = fl(ly) + SOY;
      if (ix < 0 || iy < 0 || ix >= SW || iy >= SH) continue;
      const c = SPR[iy * SW + ix];
      if (!c) continue;
      if (opt.alpha !== undefined && bay(X, Y) > opt.alpha) continue;
      const i = Y * W + X;
      BUF[i] = opt.color !== undefined ? opt.color : opt.white ? (SPK[iy * SW + ix] === 4 ? 59 : 22) : c - 1;
      if (!opt.noMask) {
        SMASK[i] = 1;
        if (X < SMB[0]) SMB[0] = X; if (Y < SMB[1]) SMB[1] = Y; if (X > SMB[2]) SMB[2] = X; if (Y > SMB[3]) SMB[3] = Y;
      }
    }
  }
  function clearMask() { if (SMB[2] >= SMB[0]) for (let y = SMB[1]; y <= SMB[3]; y++) SMASK.fill(0, y * W + SMB[0], y * W + SMB[2] + 1); SMB[0] = W; SMB[1] = H; SMB[2] = -1; SMB[3] = -1; }
  // a character in one call: build, optional ghosts and glitch, stamp; returns where its hand and sword tip are
  function actor(o, x, y, S, ang, flip, opt) {
    opt = opt || {};
    const g = buildSprite(o);
    clearMask();
    if (o.who === 'null' && !opt.clean) { // chromatic ghosts either side
      const off = Math.max(1, Math.round(S * 1.2)) + (fl(T_NOW * 12) % 3 === 0 ? 1 : 0);
      stamp(x - off, y, S, ang, flip, { color: 61, alpha: 0.35, noMask: true });
      stamp(x + off, y, S, ang, flip, { color: 42, alpha: 0.35, noMask: true });
    }
    if (opt.after) for (let k = opt.after.length - 1; k >= 0; k--) { const a = opt.after[k]; stamp(a[0], a[1], S, ang, flip, { color: a[2], alpha: a[3], noMask: true }); }
    stamp(x, y, S, ang, flip, opt);
    if (o.who === 'null' && !opt.clean) glitchRows(T_NOW, Math.max(2, Math.round(S * 1.5)) * (1 + (opt.glitch || 0) * 3), opt.glitch ? 0.6 : 0.18);
    const c = Math.cos(ang), s = Math.sin(ang), hx = (flip ? -1 : 1) * g.hand[0] * S, hy = g.hand[1] * S;
    const hand = [x + hx * c - hy * s, y + hx * s + hy * c];
    const sw = o.sword !== undefined && o.sword !== null ? o.sword : 0, da = flip ? PI - sw : sw, tipL = 29 * S;
    const tip = [hand[0] + Math.cos(da + ang) * tipL, hand[1] + Math.sin(da + ang) * tipL];
    return { hand, tip, g };
  }
  // horizontal tears through the last stamped sprite
  const ROWT = new Uint8Array(W);
  function glitchRows(t, amp, prob) {
    prob = prob || 0.18;
    const f = fl(t * 15);
    for (let y = SMB[1]; y <= SMB[3]; y++) {
      const band = fl(y / 3), r = ih(band, f, 51);
      if (r > prob) continue;
      const sh = Math.round((ih(band, f, 52) - 0.5) * 2 * amp);
      if (!sh) continue;
      const o = y * W;
      for (let x = SMB[0]; x <= SMB[2]; x++) ROWT[x] = BUF[o + x];
      for (let x = SMB[0]; x <= SMB[2]; x++) { const sx = x - sh; if (sx >= SMB[0] && sx <= SMB[2] && SMASK[o + sx]) BUF[o + x] = ROWT[sx]; }
    }
  }
  let T_NOW = 0;

  /* ================================================================ auras */
  const ADIST = new Float32Array(NP);
  // flames licking up from the last stamped sprite; cols: dark, mid, bright, core
  function aura(t, cols, R, opt) {
    opt = opt || {};
    if (SMB[2] < SMB[0]) return;
    R = Math.max(2, R);
    const x0 = Math.max(0, SMB[0] - fl(R)), x1 = Math.min(W - 1, SMB[2] + fl(R)), y0 = Math.max(0, SMB[1] - fl(R * 2)), y1 = Math.min(H - 1, SMB[3] + fl(R * 0.8));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; ADIST[i] = SMASK[i] ? 0 : 1e9; }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; let d = ADIST[i];
      if (x > x0) d = Math.min(d, ADIST[i - 1] + 1);
      if (y > y0) { d = Math.min(d, ADIST[i - W] + 1); if (x > x0) d = Math.min(d, ADIST[i - W - 1] + 1.41); if (x < x1) d = Math.min(d, ADIST[i - W + 1] + 1.41); }
      ADIST[i] = d;
    }
    for (let y = y1; y >= y0; y--) for (let x = x1; x >= x0; x--) {
      const i = y * W + x; let d = ADIST[i];
      if (x < x1) d = Math.min(d, ADIST[i + 1] + 1);
      if (y < y1) { d = Math.min(d, ADIST[i + W] + 1); if (x < x1) d = Math.min(d, ADIST[i + W + 1] + 1.41); if (x > x0) d = Math.min(d, ADIST[i + W - 1] + 1.41); }
      ADIST[i] = d;
    }
    const cyM = (SMB[1] + SMB[3]) / 2, hh = SMB[3] - SMB[1] + 1, sc = opt.scale || Math.max(1, R / 8);
    const rise = opt.rise === undefined ? 1 : opt.rise;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (SMASK[i]) continue;
      const d = ADIST[i];
      if (d > R * 2.2) continue;
      const up = y < cyM ? 1 + rise * (cyM - y) / hh * 1.1 : 0.75;
      const n = vn(x / sc, (y + t * 70 * rise) / sc, 4, 801) * 0.6 + vn(x / sc, (y + t * 110 * rise) / sc, 2, 802) * 0.4;
      const lim = R * up * (0.35 + 0.85 * n);
      if (d > lim) continue;
      const f = d / lim;
      if (f > 0.82 && bay(x, y) < 0.45) continue;
      BUF[i] = f < 0.25 ? cols[3] : f < 0.55 ? cols[2] : f < 0.82 ? cols[1] : cols[0];
    }
    // sparks streaming up off the flames
    const n = opt.sparks === undefined ? 16 : opt.sparks;
    for (let k = 0; k < n; k++) {
      const u = frac(ih(k, 1, 811) + t * (0.9 + ih(k, 2, 811)));
      const x = lerp(SMB[0] - R * 0.5, SMB[2] + R * 0.5, ih(k, 3, 811)) + Math.sin(u * 6 + k) * 2;
      const y = SMB[3] - u * (hh + R * 3);
      if (bay(fl(x), fl(y)) > 1 - u) continue;
      P(x, y, cols[u < 0.5 ? 3 : 2]); P(x, y + 1, cols[1]);
    }
  }

  /* ================================================================ effects */
  function bolt(x0, y0, x1, y1, seed, w, cCore, cEdge, jag) {
    jag = jag || 0.22;
    const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 9)), nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny) || 1;
    let px = x0, py = y0;
    for (let s = 1; s <= n; s++) {
      const u = s / n, o = s < n ? (ih(s, seed, 61) - 0.5) * 2 * jag * Math.hypot(x1 - x0, y1 - y0) / n * 3 : 0;
      const qx = lerp(x0, x1, u) + nx / L * o, qy = lerp(y0, y1, u) + ny / L * o;
      if (w > 1) thick(px, py, qx, qy, w + 1, cEdge);
      lineP(px, py, qx, qy, cCore);
      if (ih(s, seed, 62) < 0.25 && s < n) { const bx = qx + (ih(s, seed, 63) - 0.5) * 24, by = qy + (ih(s, seed, 64) - 0.5) * 24; lineP(qx, qy, bx, by, cEdge); }
      px = qx; py = qy;
    }
  }
  // speed lines streaming toward (cx, cy) from the frame edges
  function radialLines(cx, cy, n, inner, c, t, seed) {
    for (let k = 0; k < n; k++) {
      const a = ih(k, fl(t * 20), seed) * TAU, r0 = inner + ih(k, fl(t * 20) + 1, seed) * 60, r1 = 420;
      const w = ih(k, 3, seed) < 0.3 ? 2 : 1;
      for (let r = r0; r < r1; r += 1) { const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (x < 0 || y < 0 || x >= W || y >= H) break; if (bay(fl(x), fl(y)) < 0.25 + (r - r0) / 300) { P(x, y, c); if (w > 1) P(x + Math.sin(a), y - Math.cos(a), c); } }
    }
  }
  // parallel streaks moving along angle a (motion blur of the world behind a fast flier)
  function streaks(a, n, t, speed, c, len, seed, area) {
    const ca = Math.cos(a), sa = Math.sin(a), A = area || [0, 0, W, H];
    for (let k = 0; k < n; k++) {
      const L = len * (0.5 + ih(k, 1, seed)), px = ih(k, 2, seed) * (A[2] + 200) - 100, py = ih(k, 3, seed) * A[3] + A[1];
      const off = frac(ih(k, 4, seed) + t * speed / 600) * 700 - 200;
      const x0 = px + ca * off, y0 = py + sa * off;
      lineF(x0, y0, x0 + ca * L, y0 + sa * L, (x, y, u) => { if (bay(x, y) < 0.9 - u * 0.6) P(x, y, c); });
    }
  }
  function shockRing(cx, cy, r, ry, w, cols, fade) {
    for (let k = 0; k < w; k++) ring(cx, cy, r - k, ry === null ? r - k : ry * (r - k) / r, k < 1 ? cols[0] : k < w * 0.5 ? cols[1] : cols[2], (x, y) => bay(fl(x), fl(y)) < fade);
  }
  function burst(cx, cy, u, R, rays, rot, cols, th) {
    if (u <= 0 || u >= 1) return;
    const len = R * eoc(u), w0 = th * (1 - u);
    for (let k = 0; k < rays; k++) {
      const a = rot + k * TAU / rays + (ih(k, 1, 71) - 0.5) * 0.25, L = len * (0.55 + 0.45 * ih(k, 2, 71));
      lineF(cx, cy, cx + Math.cos(a) * L, cy + Math.sin(a) * L, (x, y, f) => { if (f > u * 0.85) { P(x, y, f < 0.6 ? cols[0] : cols[1]); if (w0 > 1.2) P(x + 1, y, cols[1]); } });
    }
  }
  // flying debris with gravity
  function debris(cx, cy, age, n, spread, up, cols, seed, g) {
    if (age < 0) return;
    g = g === undefined ? 260 : g;
    for (let k = 0; k < n; k++) {
      const a = -PI * (0.1 + 0.8 * ih(k, 1, seed)), v = spread * (0.4 + ih(k, 2, seed));
      const x = cx + Math.cos(a) * v * age * 1.2, y = cy + Math.sin(a) * v * age * up + g * age * age;
      const s = 1 + fl(ih(k, 3, seed) * 3);
      rectF(x, y, s, s, cols[k % cols.length]); if (s > 1) P(x, y, cols[0]);
    }
  }
  // an energy beam from (x0, y0) to (x1, y1)
  function beam(x0, y0, x1, y1, w, cols, t, seed) {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, L = Math.sqrt(L2) || 1;
    const bx0 = Math.max(0, fl(Math.min(x0, x1) - w * 2)), bx1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + w * 2));
    const by0 = Math.max(0, fl(Math.min(y0, y1) - w * 2)), by1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + w * 2));
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, u = clamp((px * dx + py * dy) / L2, 0, 1);
      const qx = px - u * dx, qy = py - u * dy, d = Math.sqrt(qx * qx + qy * qy);
      const wob = w * (0.85 + 0.15 * Math.sin(u * L * 0.25 - t * 40 + seed) + 0.08 * Math.sin(u * L * 0.7 + t * 23));
      if (d > wob * 1.5) continue;
      const f = d / wob;
      if (f > 1 && bay(x, y) > (1.5 - f) * 1.4) continue;
      BUF[y * W + x] = f < 0.35 ? 22 : f < 0.6 ? cols[3] : f < 0.85 ? cols[2] : f < 1 ? cols[1] : cols[0];
    }
    // spiralling rings around the beam
    for (let k = 0; k < Math.floor(L / 16); k++) {
      const u = frac(k / Math.floor(L / 16) - t * 2.2), cx = x0 + dx * u, cy = y0 + dy * u, nx = -dy / L, ny = dx / L;
      for (let a = 0; a < TAU; a += 0.15) { const r = w * 1.35, z = Math.sin(a); if (z < 0) continue; P(cx + nx * Math.cos(a) * r + dx / L * z * 2, cy + ny * Math.cos(a) * r + dy / L * z * 2, cols[2]); }
    }
  }
  // two-tone impact frame: everything collapses to ink and light, with a burst of lines
  function impactFrame(cx, cy, mode) {
    for (let i = 0; i < NP; i++) { const p = PAL[BUF[i]], l = p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15; BUF[i] = mode ? (l > 110 ? 0 : 22) : (l > 140 ? 22 : 0); }
    for (let k = 0; k < 40; k++) { const a = ih(k, 1, 81) * TAU, r0 = 30 + ih(k, 2, 81) * 40; lineF(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * 500, cy + Math.sin(a) * 500, (x, y) => P(x, y, mode ? 22 : 0)); }
  }
  function flashWhite(a) { if (a <= 0) return; if (a >= 1) { BUF.fill(22); return; } tintAll(T_WH, a); }

  /* ================================================================ backgrounds */
  function gradient(y0, y1, ramp, shift) {
    for (let y = Math.max(0, fl(y0)); y < Math.min(H, y1); y++) {
      const f = clamp((y - y0) / (y1 - y0), 0, 0.9999) * (ramp.length - 1) + (shift || 0), k = fl(f), r = f - k;
      const a = ramp[clamp(k, 0, ramp.length - 1)], b = ramp[clamp(k + 1, 0, ramp.length - 1)];
      for (let x = 0; x < W; x++) BUF[y * W + x] = bay(x, y) < r ? b : a;
    }
  }
  function stars(t, y1, n, seed) {
    for (let k = 0; k < n; k++) { const x = fl(ih(k, 1, seed) * W), y = fl(ih(k, 2, seed) * y1), tw = frac(ih(k, 3, seed) + t * 0.6); P(x, y, tw < 0.15 ? 22 : tw < 0.5 ? 20 : 19); }
  }
  function ridge(yb, h, sc, seed, c, cl, ox) {
    for (let x = 0; x < W; x++) {
      const wx = x + (ox || 0), top = yb - h * fbm(wx, 0, sc, 4, seed);
      for (let y = Math.max(0, fl(top)); y < Math.min(H, yb + 400); y++) BUF[y * W + x] = cl !== undefined && y < top + 2 && fbm(wx + 3, 0, sc, 4, seed) > fbm(wx, 0, sc, 4, seed) ? cl : c;
    }
  }
  function canopy(yb, sc, seed, c, cl, ox, rough) {
    for (let x = 0; x < W; x++) {
      const wx = x + (ox || 0), crowns = Math.abs(Math.sin(wx / sc * 3.1 + vn(wx, 0, sc, seed) * 4)) * sc * 0.45 + vn(wx, 0, sc * 3, seed + 1) * sc * (rough || 1);
      const top = yb - crowns;
      for (let y = Math.max(0, fl(top)); y < H; y++) BUF[y * W + x] = cl !== undefined && y < top + 1.5 ? cl : c;
    }
  }
  // a bank of cumulus: lumpy tops lit from one side, flat darker bases
  function cloudBank(yb, h, sc, seed, ox, cols, lightLeft) {
    for (let x = 0; x < W; x++) {
      const wx = x + (ox || 0), f = fbm(wx, 0, sc, 4, seed), top = yb - h * f, sl = fbm(wx + 2, 0, sc, 4, seed) - f;
      for (let y = Math.max(0, fl(top)); y < H; y++) {
        const dd = y - top, v = dd < 2 ? ((lightLeft ? -sl : sl) > 0 ? 3 : 2) : dd < 6 ? 2 : dd < 16 + 10 * vn(wx, y, 9, seed + 2) ? 1 : 0;
        BUF[y * W + x] = bay(x, y) < 0.18 && v > 0 ? cols[v - 1] : cols[v];
      }
    }
  }
  // a puffy cloud blob centred at (cx, cy), radius r
  function cloudPuff(cx, cy, r, cols, seed) {
    const x0 = Math.max(0, fl(cx - r * 1.6)), x1 = Math.min(W - 1, Math.ceil(cx + r * 1.6)), y0 = Math.max(0, fl(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r * 0.7));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / (r * 1.6), dy = (y + 0.5 - cy) / r, n = vn(x, y, Math.max(3, r * 0.35), seed);
      const d = dx * dx + dy * dy * (dy > 0 ? 3 : 1) - (n - 0.5) * 0.7;
      if (d > 1) continue;
      const l = -dy * 0.8 - dx * 0.3 + (n - 0.5) * 0.6;
      const v = l > 0.45 ? 3 : l > 0 ? 2 : l > -0.45 ? 1 : 0;
      BUF[y * W + x] = d > 0.82 && bay(x, y) < 0.5 ? cols[Math.max(0, v - 1)] : cols[v];
    }
  }
  function letterbox(h) { rectF(0, 0, W, h, 0); rectF(0, H - h, W, h, 0); }

  /* ================================================================ direction: key tracks, fighters, hits, camera */
  // a key track is a list of poses in time: {t, x, y, a (body angle), sw (sword angle), S, reach, sq, alpha, e (ease into this key), ...};
  // numbers ease from key to key, everything else (eyes, mouth, flip, white, glitch ...) holds until the next key changes it
  const EASE = { l: (u) => u, o: eoc, i: eic, io: eio, b: eob, s: (u) => (u >= 1 ? 1 : 0) };
  const NUMF = ['x', 'y', 'a', 'sw', 'reach', 'sq', 'S', 'alpha', 'vib', 'breath'];
  function K(...keys) { for (let i = 1; i < keys.length; i++) for (const f in keys[i - 1]) if (!(f in keys[i]) && f !== 'e' && f !== 't') keys[i][f] = keys[i - 1][f]; return keys; }
  function trk(keys, t) {
    let k = 0;
    while (k < keys.length - 1 && keys[k + 1].t <= t) k++;
    const A = keys[k], B = keys[k + 1], o = Object.assign({}, A);
    if (B && t > A.t) {
      const u = EASE[B.e || 'io'](clamp((t - A.t) / (B.t - A.t), 0, 1));
      for (const f of NUMF) if (typeof A[f] === 'number' && typeof B[f] === 'number') o[f] = A[f] + (B[f] - A[f]) * u;
    }
    return o;
  }
  // hit-stop: the track clock stops for d seconds at each hit (hits given in track time); returns [track time, frozen]
  function stopClock(lt, hits, d) {
    let o = lt, fz = false;
    for (let k = 0; k < hits.length; k++) { const h = hits[k] + k * d; if (lt >= h && lt < h + d) fz = true; o -= clamp(lt - h, 0, d); }
    return [o, fz];
  }
  const rawT = (tt, hits, d) => { let o = tt; for (const h of hits) if (h < tt) o += d; return o; };   // track time → shot time

  // a swing smear: a crescent swept from angle a0 to a1 about (hx, hy), thick at the leading edge, thinning into its tail
  function smearArc(hx, hy, a0, a1, L, cols) {
    let d = a1 - a0;
    while (d > PI) d -= TAU;
    while (d < -PI) d += TAU;
    if (Math.abs(d) < 0.3) return;
    const R = L * 1.1, x0 = Math.max(0, fl(hx - R)), x1 = Math.min(W - 1, Math.ceil(hx + R)), y0 = Math.max(0, fl(hy - R)), y1 = Math.min(H - 1, Math.ceil(hy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (SMASK[i]) continue;
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy, r = Math.hypot(dx, dy);
      if (r > R || r < L * 0.6) continue;
      let rel = Math.atan2(dy, dx) - a0;
      rel = d > 0 ? ((rel % TAU) + TAU) % TAU : ((-rel % TAU) + TAU) % TAU;
      if (rel > Math.abs(d)) continue;
      const u = rel / Math.abs(d), rin = L * lerp(1.0, 0.62, u * u), rout = L * lerp(1.02, 1.06, u);
      if (r < rin || r > rout) continue;
      const e = (r - rin) / (rout - rin), b = bay(x, y);
      if (b > u * 1.6) continue;                          // the tail dissolves
      BUF[i] = e > 0.72 && u > 0.7 ? 22 : u > 0.75 ? cols[2] : u > 0.45 ? (b < 0.5 ? cols[2] : cols[1]) : cols[0];
    }
  }

  // one character driven by a key track: it leans into its motion, stretches with speed, leaves afterimages and smears its swings
  let FRZ = 0;
  function fighter(who, keys, lt, base) {
    base = base || {};
    const p = trk(keys, lt);
    if (p.hide || p.alpha === 0) return null;
    const q = trk(keys, lt - 1 / 30), q2 = trk(keys, lt - 2 / 30);
    const vx = (p.x - q.x) * 30, vy = (p.y - q.y) * 30, sp = Math.hypot(vx, vy);
    const S = p.S || base.S || 2, ox = base.ox || 0, oy = base.oy || 0;
    const lean = p.nolean ? 0 : clamp(vx / 1300, -0.45, 0.45);
    const sq = (p.sq || 0) + (p.breath ? Math.sin(T_NOW * 11) * p.breath : 0) + (sp > 150 ? clamp((Math.abs(vx) - Math.abs(vy)) / 2400, -0.4, 0.4) : 0);
    const vib = (p.vib || 0) + FRZ, f = fl(T_NOW * 30);
    const jx = vib ? Math.round((ih(f, 3, 601) - 0.5) * 2 * vib) : 0, jy = vib ? Math.round((ih(f, 4, 601) - 0.5) * 2 * vib) : 0;
    let legs = p.legs;
    if (p.run) { const s = Math.sin(lt * 20); legs = [Math.max(0, s) * 3, Math.max(0, -s) * 3, Math.max(0, -s) * 3, Math.max(0, s) * 3]; }
    const o = { who, eyes: p.eyes, mouth: p.mouth, sword: typeof p.sw === 'number' ? p.sw : undefined, swordCols: base.swc, legs, fly: p.fly, sq, reach: p.reach, shade: base.shade };
    const after = [];
    if (sp > 380 && !p.noAfter) for (let k = 1; k <= 3; k++) { const a = trk(keys, lt - k * 0.03); after.push([a.x + ox, a.y + oy, base.ghost || (who === 'null' ? 42 : 37), 0.55 - k * 0.14]); }
    const ang = (p.a || 0) + lean;
    const res = actor(o, p.x + jx + ox, p.y + jy + oy, S, ang, !!p.flip, { after, white: p.white, alpha: p.alpha, glitch: p.glitch });
    if (base.aura) aura(T_NOW, base.aura, base.auraR || 7, { sparks: base.sparks === undefined ? 8 : base.sparks, rise: base.rise });
    if (typeof p.sw === 'number' && typeof q2.sw === 'number' && !q2.hide && q2.alpha !== 0) {
      const sa = (p.flip ? PI - p.sw : p.sw) + ang, sa0 = (q2.flip ? PI - q2.sw : q2.sw) + (q2.a || 0) + lean;
      smearArc(res.hand[0], res.hand[1], sa0, sa, 30 * S, base.smear || [19, 20, 21]);
    }
    return { x: p.x + ox, y: p.y + oy, vx, vy, sp, S, hand: res.hand, tip: res.tip, p };
  }
  // dust kicked up behind a fighter skidding along the ground at gy (feet sit 14·S below the body centre)
  function dustTrail(keys, lt, S, gy, oy, seed) {
    for (let k = 1; k <= 7; k++) {
      const a = trk(keys, lt - k * 0.035), b = trk(keys, lt - k * 0.035 - 1 / 30);
      if (a.hide || a.alpha === 0 || Math.abs(a.y + 14 * S - gy) > 5 || Math.abs(a.x - b.x) * 30 < 140) continue;
      const r = 2 + k * 1.7, x = a.x + (ih(k, fl(lt * 30) - k, seed) - 0.5) * 6, y = gy + (oy || 0) - r * 0.5;
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r && bay(fl(x + xx), fl(y + yy)) > k / 9) P(x + xx, y + yy, yy < -r * 0.3 ? 31 : 30);
    }
  }
  // the moment of a hit (g seconds after it): ink flash, starburst, ring, sparks, glow and shake
  function hitFx(x, y, g, power, cols) {
    if (g < 0 || g > 0.5) return;
    power = power || 1; cols = cols || [22, 59];
    burst(x, y, g / 0.3, 90 * power, 14, ih(fl(x), fl(y), 611) * TAU, cols, 3);
    shockRing(x, y, 6 + g * 320 * power, 4 + g * 210 * power, 3, [22, 20, 19], 1 - g / 0.35);
    for (let k = 0; k < 18; k++) {
      const a = ih(k, fl(x), 612) * TAU, v = (60 + ih(k, 2, 612) * 170) * power, px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 200 * g * g;
      if (g < 0.4) { P(px, py, 22); P(px - Math.cos(a) * 2, py - Math.sin(a) * 2, cols[1]); }
    }
    glow(x, y, 50 * power * Math.max(0, 1 - g * 2), T_WH, 0.7);
    shk(5 * power * Math.max(0, 1 - g * 3));
    if (power >= 1 && g < (power >= 1.5 ? 0.067 : 0.034)) impactFrame(x, y, 1);
  }

  // the camera, applied to the finished shot: zoom z and roll r about (fx, fy), which lands on screen at (sx, sy)
  const TMP = new Uint8Array(NP);
  function cam(z, r, fx, fy, sx, sy) {
    if (sx === undefined) { sx = fx; sy = fy; }
    if (Math.abs(z - 1) < 0.002 && Math.abs(r) < 0.002 && fx === sx && fy === sy) return;
    TMP.set(BUF);
    const c = Math.cos(r) / z, s = Math.sin(r) / z;
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - sy;
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - sx;
        let X = fl(fx + dx * c + dy * s), Y = fl(fy - dx * s + dy * c);
        X = X < 0 ? 0 : X >= W ? W - 1 : X; Y = Y < 26 ? 26 : Y >= H - 26 ? H - 27 : Y;
        BUF[y * W + x] = TMP[Y * W + X];
      }
    }
  }
  // a whip-pan smear along angle dir, amt pixels long
  function whip(amt, dir) {
    if (amt < 1) return;
    TMP.set(BUF);
    const f = fl(T_NOW * 30), ca = Math.cos(dir), sa = Math.sin(dir);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = ih(fl(x / 3), y, f + 620) * amt;
      let X = fl(x - ca * k), Y = fl(y - sa * k);
      X = X < 0 ? 0 : X >= W ? W - 1 : X; Y = Y < 0 ? 0 : Y >= H ? H - 1 : Y;
      BUF[y * W + x] = TMP[Y * W + X];
    }
  }
  // a crash-zoom streak: every pixel pulled a random way toward (cx, cy)
  function zoomBlur(cx, cy, amt) {
    if (amt < 0.01) return;
    TMP.set(BUF);
    const f = fl(T_NOW * 30);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = 1 - amt * ih(fl(x / 2), fl(y / 2), f + 630);
      let X = fl(cx + (x - cx) * k), Y = fl(cy + (y - cy) * k);
      X = X < 0 ? 0 : X >= W ? W - 1 : X; Y = Y < 0 ? 0 : Y >= H ? H - 1 : Y;
      BUF[y * W + x] = TMP[Y * W + X];
    }
  }

  /* ================================================================ the film: shots */
  const LB = 26;                                           // letterbox bar height
  const SKY_DUSK = [3, 4, 5, 10, 11, 12, 13, 14, 15], SKY_RED = [1, 9, 10, 11, 12, 13], SKY_HIGH = [2, 3, 4, 5, 6, 7], SKY_DAWN = [4, 5, 6, 7, 8, 19, 15, 16];
  const CLOUD_RED = [9, 10, 11, 12], CLOUD_HI = [17, 18, 20, 21], CLOUD_GOLD = [18, 19, 15, 16];
  const HERO = (o) => Object.assign({ who: 'hero' }, o), NULLO = (o) => Object.assign({ who: 'null' }, o);
  const AURA_NULL = [39, 43, 42, 44], AURA_GOLD = [58, 58, 59, 60], AURA_RAIN = (t) => EL[fl(t * 8) % 4].slice(0, 3).concat([60]);
  const GOLD_SW = [58, 59, 60, 59], SM_GOLD = [58, 59, 60], SM_RED = [43, 42, 44];
  const HERO_GOLD = { swc: GOLD_SW, smear: SM_GOLD, ghost: 59, aura: AURA_GOLD, auraR: 7 };
  let SHAKE_A = 0;
  const shk = (a) => { SHAKE_A = Math.max(SHAKE_A, a); };
  // the crack in the sky the Null comes through
  function skyCrack(cx, y0, y1, open, t, scale) {
    scale = scale || 1;
    if (open <= 0) return;
    glow(cx, (y0 + y1) / 2, (y1 - y0) * 0.9 * open, T_RED, 0.55 * open);
    for (let y = fl(y0); y <= y1; y++) {
      const u = (y - y0) / (y1 - y0), jag = (vn(y, 0, 6 * scale, 91) - 0.5) * 26 * scale + (vn(y, 0, 2, 92) - 0.5) * 6 * scale;
      const w = open * (1 - Math.abs(u - 0.5) * 1.8) * 9 * scale + 0.5, x = cx + jag;
      for (let q = -fl(w) - 2; q <= fl(w) + 2; q++) P(x + q, y, Math.abs(q) <= w ? (Math.abs(q) < w - 1.5 ? 0 : 42) : 43);
    }
    for (let k = 0; k < 30 * open; k++) { // squares of broken sky drifting off the edges
      const u = frac(ih(k, 1, 93) + t * 0.25), y = lerp(y0, y1, ih(k, 2, 93)), x = cx + (vn(y, 0, 6 * scale, 91) - 0.5) * 26 * scale + (ih(k, 3, 93) < 0.5 ? -1 : 1) * (10 + u * 50) * scale;
      const s = 1 + fl(ih(k, 4, 93) * 3);
      if (bay(fl(x), fl(y)) > 1 - u) continue;
      rectF(x, y - u * 10, s, s, ih(k, 5, 93) < 0.5 ? 0 : 42);
    }
  }
  function grassField(y0, ox, cols) {
    for (let y = Math.max(0, fl(y0)); y < H; y++) for (let x = 0; x < W; x++) {
      const wx = x + ox * (1 + (y - y0) / 40), n = vn(wx, y * 3, 6, 95);
      BUF[y * W + x] = y < y0 + 2 ? cols[2] : n > 0.62 ? cols[2] : n > 0.35 ? cols[1] : cols[0];
    }
  }
  // the dusk meadow of the ground fight; camX pans it sideways, camY tilts the camera up (the ground drops away)
  const GY = 206, FY = (S) => GY - 14 * S;                 // ground line, and the body centre of a fighter standing on it
  function field(t, camX, camY) {
    camY = camY || 0;
    gradient(LB, H - LB, SKY_RED);
    skyCrack(240 - camX * 0.1, LB + camY * 0.3, 120 + camY * 0.3, 0.7, t, 1.1);
    ridge(196 + camY, 26, 50, 141, 9, 10, camX * 0.3);
    canopy(206 + camY, 8, 142, 1, 10, camX * 0.6, 1.0);
    grassField(GY + camY, camX, [24, 25, 26]);
  }
  function groundCracks(cx, cy, len, n, seed, c0, c1) {
    for (let k = 0; k < n; k++) {
      const a = PI * (ih(k, 1, seed) < 0.5 ? ih(k, 2, seed) * 0.4 : 1 - ih(k, 2, seed) * 0.4);
      let x = cx, y = cy;
      for (let s = 0; s < 7; s++) { const nx = x + Math.cos(a) * len / 7 + (ih(k, s, seed + 1) - 0.5) * 8, ny = y + Math.abs(Math.sin(a)) * len / 50 + (ih(k, s, seed + 2) - 0.5) * 2; lineP(x, y, nx, ny, s < 2 ? c0 : c1); x = nx; y = ny; }
    }
  }
  const SHOTS = [];
  const shot = (t0, t1, fn, opt) => SHOTS.push(Object.assign({ t0, t1, fn }, opt || {}));
  // filled by the shot files: captions [t0, t1, kind, speaker, text, y], white cut-flashes, whip pans [t, direction]
  const CAPS = [], FLASH_CUTS = [], WHIPS = [];

  /* ================================================================ the Unmaker */
  // A colossus made of night: a body of void with stars drifting inside it and a magenta rim, long many-jointed arms with
  // pale fingers, a halo of black shards turning behind its head, and a face that is a white porcelain mask with three
  // vertical eyes. The mask can smile (a hairline split), grin (a mouth of starlight teeth), crack, grow a fourth eye,
  // and finally break away from what is underneath: a spiral eye like a black hole.
  // (cx, cy): the centre of the mask; s: scale (1 → the mask is 34 × 46 px); o: the face and body state.
  const VOID = [76, 77, 78, 79, 80], MAG = [70, 71, 72, 73, 74, 75], BONE = [69, 68, 67, 66, 65, 64];
  function voidFill(x, y, t, depth) {
    // night with stars drifting through it (the stars live in the body, they don't move with the camera)
    const n = vn(x * 0.7, y * 0.7 + t * 6, 18, 701), st = ih(x >> 1, (y + fl(t * 8)) >> 1, 702);
    if (st < 0.004) return 22; if (st < 0.012) return 57; if (st < 0.016) return 75;
    return VOID[clamp(fl(n * 3.2 + (depth || 0)), 0, 4)];
  }
  // the silhouette of the body: shoulders, a long falling shape, tendrils that drift (local units, mask centre at 0,0)
  function bodyInside(lx, ly, t) {
    if (ly < 16) return false;
    const ax = Math.abs(lx);
    // the shoulders rise into blades of night either side, and a smaller pair inside them
    if (ly < 32 && ax > 48 && ax < 72 && ly > 2 + Math.abs(ax - 62) * 1.5) return true;
    if (ly < 30 && ax > 36 && ax < 52 && ly > 12 + Math.abs(ax - 44) * 1.6) return true;
    const hw = ly < 30 ? lerp(11, 66, eoc((ly - 16) / 14)) : ly < 52 ? lerp(66, 56, (ly - 30) / 22) : ly < 112 ? lerp(56, 40, (ly - 52) / 60) : 40 + (ly - 112) * 0.4;
    const wave = Math.sin(ly * 0.06 - t * 1.6) * 6 + Math.sin(ly * 0.17 + t * 2.3) * 3;
    if (Math.abs(lx - wave * 0.4) > hw) return false;
    if (ly > 112) { const strand = Math.sin((lx + wave) * 0.2 + ly * 0.015) * 0.5 + 0.5; if (strand < (ly - 112) / 150) return false; }
    return true;
  }
  function spiralEye(cx, cy, r, t, open) {
    const x0 = Math.max(0, fl(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, fl(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) / r; if (d > 1) continue;
      const a = Math.atan2(dy, dx), sp = frac((a / TAU) * 3 + Math.log(d + 0.02) * 1.6 - t * 0.9);
      let c;
      if (d < 0.16 * open) c = d < 0.04 ? 22 : 76;                                   // the hole, and a pinpoint of white at its heart
      else if (d < 0.22 * open) c = (fl(a * 6 + t * 8) & 1) ? 75 : 73;              // the burning ring around it
      else c = sp < 0.18 ? MAG[3 + (d < 0.5 ? 1 : 0)] : sp < 0.4 ? MAG[1] : VOID[fl(d * 3) + 1];
      if (d > 0.9 && bay(x, y) < (d - 0.9) * 10) continue;
      BUF[y * W + x] = c;
    }
    // rings of teeth/glyphs turning around it
    for (let ring_ = 0; ring_ < 2; ring_++) { const rr = r * (0.55 + ring_ * 0.32), n = 18 + ring_ * 8; for (let k = 0; k < n; k++) { const a = k / n * TAU + t * (ring_ ? -0.5 : 0.7); const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; rectF(px - 1, py - 1, 2 + ring_, 2 + ring_, ring_ ? 75 : 22); } }
  }
  // o: { eyes 0 closed .. 1 open .. 2 wide, look: [x, y], smile 0..1, grin 0..1, crack 0..1, eye4 0..1, broken 0..1,
  //      arms [[shoulder x, y, hand x, y, spread], ...] (local units), halo 0..1, body (draw the body), glow 0..1, shake }
  function unmaker(cx, cy, s, t, o) {
    o = o || {};
    const L = (lx, ly) => [cx + lx * s, cy + ly * s];
    // the halo of shards, behind everything
    if (o.halo !== 0) {
      const ha = o.halo === undefined ? 1 : o.halo;
      glow(cx, cy - 6 * s, 80 * s, T_MAG, 0.25 * ha);
      for (let ring_ = 0; ring_ < 2; ring_++) {
        const R = (44 + ring_ * 18) * s, n = 14 + ring_ * 6, rot = t * (ring_ ? -0.18 : 0.26);
        for (let k = 0; k < n; k++) {
          if (ih(k, ring_, 703) > ha * 1.1) continue;
          const a = k / n * TAU + rot, px = cx + Math.cos(a) * R, py = cy - 6 * s + Math.sin(a) * R * 0.92, sz = (2 + ih(k, 4, 703) * 3) * s;
          // a black shard: a thin diamond pointing outward, rimmed with magenta
          const ux = Math.cos(a), uy = Math.sin(a);
          for (let q = -sz * 1.8; q <= sz * 1.8; q += 0.5) { const w = (1 - Math.abs(q) / (sz * 1.8)) * sz * 0.55; for (let p = -w; p <= w; p += 0.5) P(px + ux * q - uy * p, py + uy * q + ux * p, Math.abs(p) > w - 0.8 ? 73 : 76); }
          if (k % 3 === 0) P(px, py, 75);
        }
      }
    }
    // the body
    if (o.body !== false) {
      const bx0 = Math.max(0, fl(cx - 80 * s)), bx1 = Math.min(W - 1, Math.ceil(cx + 80 * s)), by0 = Math.max(0, fl(cy + 12 * s)), by1 = Math.min(H - 1, Math.ceil(cy + 260 * s));
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
        const lx = (x + 0.5 - cx) / s, ly = (y + 0.5 - cy) / s;
        if (!bodyInside(lx, ly, t)) { if (bodyInside(lx + 1.6 / s, ly, t) || bodyInside(lx - 1.6 / s, ly, t) || bodyInside(lx, ly - 1.6 / s, t)) BUF[y * W + x] = bay(x, y) < 0.5 ? 73 : 72; continue; }
        const rim = !bodyInside(lx + 1.2 / s, ly, t) || !bodyInside(lx - 1.2 / s, ly, t) || !bodyInside(lx, ly - 1.2 / s, t);
        // the heart: a slowly turning sigil of magenta in the chest
        const hx = lx, hy = ly - 54, hr = Math.hypot(hx, hy), ha = Math.atan2(hy, hx) + t * 0.6;
        const sig = (Math.abs(hr - 12) < 0.9 || Math.abs(hr - 7) < 0.7 || (hr < 12 && Math.abs(Math.sin(ha * 3)) < 0.08 && hr > 7)) && (o.heart !== 0);
        BUF[y * W + x] = rim ? 74 : sig ? (hr < 8 ? 75 : 73) : voidFill(x, y, t, ly < 40 ? 1.2 : 0);
      }
      if (o.heart !== 0) glow(cx, cy + 54 * s, 18 * s, T_MAG, 0.35);
    }
    // arms: long thin void limbs in three segments, magenta-rimmed, ending in pale many-jointed fingers
    for (const A of o.arms || []) {
      const [sx, sy, hx, hy, spread] = A, [ax, ay] = L(sx, sy), [bx, by] = L(hx, hy), mx = (ax + bx) / 2 + (by - ay) * 0.18, my = (ay + by) / 2 - (bx - ax) * 0.18;
      for (const [p0, p1, w] of [[[ax, ay], [mx, my], 5], [[mx, my], [bx, by], 3.5]]) { thick(p0[0], p0[1], p1[0], p1[1], Math.max(2, w * s + 2), 73); thick(p0[0], p0[1], p1[0], p1[1], Math.max(1, w * s), 77); }
      discF(mx, my, 3 * s, 74); discF(mx, my, 2 * s, 77);
      const ha = Math.atan2(by - my, bx - mx);
      discF(bx, by, 4.5 * s, 66); discF(bx - Math.cos(ha) * s, by - Math.sin(ha) * s, 3.5 * s, 65);
      for (let f = -2; f <= 2; f++) {
        const fa = ha + f * (0.28 + (spread || 0) * 0.25), L1 = (7 + (f === 0 ? 2 : 0) - Math.abs(f)) * s, bend = (spread || 0) * 0.5 + 0.3;
        const k1 = [bx + Math.cos(fa) * 4 * s, by + Math.sin(fa) * 4 * s], k2 = [k1[0] + Math.cos(fa) * L1, k1[1] + Math.sin(fa) * L1], k3 = [k2[0] + Math.cos(fa + bend) * L1 * 0.8, k2[1] + Math.sin(fa + bend) * L1 * 0.8];
        thick(k1[0], k1[1], k2[0], k2[1], Math.max(1, 1.6 * s), 65); thick(k2[0], k2[1], k3[0], k3[1], Math.max(1, 1.3 * s), 66);
        P(k2[0], k2[1], 68); P(k3[0], k3[1], 69);
      }
    }
    // the mask (or what is left of it)
    const brk = o.broken || 0, sh = o.shake ? (ih(fl(t * 30), 5, 704) - 0.5) * o.shake : 0;
    if (brk > 0) spiralEye(cx, cy - 2 * s, 22 * s * (0.6 + 0.4 * eoc(brk)), t, eoc(brk));
    const RX = 16 * s, RY = 27 * s, x0 = Math.max(0, fl(cx - RX - 2 - brk * 60 * s)), x1 = Math.min(W - 1, Math.ceil(cx + RX + 2 + brk * 60 * s)), y0 = Math.max(0, fl(cy - RY - 2)), y1 = Math.min(H - 1, Math.ceil(cy + RY + 2 + brk * 90 * s));
    const eyes = o.eyes === undefined ? 1 : o.eyes, crack = o.crack || 0, smile = o.smile || 0, grin = o.grin || 0, look = o.look || [0, 0];
    const SOCK = [[-6.5, -4, -0.38], [6.5, -4, 0.38]], CRACK = [[11, -26], [8, -19], [10, -14], [5, -8], [7, -3], [2, 3], [3, 9], [-2, 16], [-1, 22]];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let lx = (x + 0.5 - cx - sh) / s, ly = (y + 0.5 - cy) / s;
      // broken: the mask splits down a jagged line, the halves drift apart, tilt and fall
      if (brk > 0) { const split = Math.sin(ly * 0.5) * 2; let side = 0; for (const sd of [-1, 1]) { const dxh = sd * brk * 34, dyh = brk * brk * 70, qx = lx - dxh, qy = ly - dyh - sd * qx * brk * 0.15; if ((sd < 0 && qx < split) || (sd > 0 && qx >= split)) { side = sd; lx = qx; ly = qy; break; } } if (!side) continue; }
      // a long face: a round brow, cheekbones, a narrow pointed chin
      const v = ly / 27, prof = v < 0 ? Math.sqrt(Math.max(0, 1 - v * v)) : Math.sqrt(Math.max(0, 1 - v * v)) * (1 - 0.42 * v), u = lx / 16;
      if (Math.abs(u) > prof) continue;
      const e = Math.abs(u) / Math.max(0.01, prof), lit = -u * 0.55 - v * 0.6 + (Math.abs(u) < 0.12 && v > -0.35 && v < 0.25 ? 0.5 : 0);
      let c = BONE[clamp(fl(3.5 + lit * 2 - (e > 0.86 ? 1.6 : 0) - (v > 0.05 && v < 0.3 && Math.abs(u) > 0.42 && Math.abs(u) < 0.85 ? 1 : 0) - (v > 0.55 ? 0.8 : 0)), 0, 5)];
      if (Math.abs(lx - 9 + Math.sin(ly * 0.7) * 1.5) < 0.6 && ly > -24 && ly < -10) c = 67;            // a hairline crack in the brow
      // the sockets: hollow, slanted into a scowl; a burning slit in each
      for (const [ex, ey, rot] of SOCK) {
        const dx = lx - ex, dy = ly - ey, rx = dx * Math.cos(rot) + dy * Math.sin(rot), ry = -dx * Math.sin(rot) + dy * Math.cos(rot), sz = 1 + (eyes > 1 ? 0.15 : 0);
        const inn = (rx * rx) / (4.6 * sz) ** 2 + (ry * ry) / (2.7 * sz) ** 2;
        if (inn < 1) { c = inn > 0.7 ? 77 : 76; const px = dx - look[0] * 1.6, py = dy - look[1] * 1.2, sw = eyes > 1 ? 1.0 : 0.6; if (eyes > 0.05 && Math.abs(px) < sw * Math.min(1, eyes) && Math.abs(py) < 2.4) c = Math.abs(px) < 0.35 && Math.abs(py) < 1.2 ? 22 : eyes > 1 ? 75 : 74; }
        else if (inn < 1.35) c = Math.min(c, 67) === c ? c : 67;
        // black streaks running down from the sockets, like old tears
        if (dy > 1.5 && dy < 18 && Math.abs(dx - Math.sin(dy * 0.5 + ex) * 0.8 + (ex < 0 ? -1.5 : 1.5)) < 0.45 + (dy > 14 ? 0.2 : 0)) c = 77;
      }
      // the fissure in the forehead: a third eye, vertical
      { const dx = lx, dy = ly + 16, inn = (dx * dx) / (1.7 ** 2) + (dy * dy) / (5.5 ** 2); if (inn < 1) c = eyes > 0.05 && Math.abs(dx) < 0.5 * Math.min(1, eyes) + (eyes > 1 ? 0.3 : 0) && Math.abs(dy) < 4 ? (eyes > 1 ? 75 : 74) : 76; else if (inn < 1.4) c = 67; }
      // veins of magenta spreading from the eyes when they burn wide
      // veins of magenta forking out from the sockets when the eyes burn wide
      if (eyes > 1.2) { const k = eyes - 1.2; for (const [ex, ey] of SOCK) for (let j = 0; j < 4; j++) { const a = (ex < 0 ? PI : 0) + (j - 1.5) * 0.55, dx = lx - ex, dy = ly - ey, along = dx * Math.cos(a) + dy * Math.sin(a), across = -dx * Math.sin(a) + dy * Math.cos(a) + Math.sin(along * 0.9 + j) * 1.1; if (along > 4.5 && along < 4.5 + 7 * k && Math.abs(across) < 0.4) c = along < 7 ? 73 : 72; } }
      // the crack: a jagged fracture from the brow down across the face (and a branch), burning inside, growing with crack
      if (crack > 0) { let dmin = 1e9, along = 0, acc = 0; for (let i = 0; i + 1 < CRACK.length; i++) { const [ax, ay] = CRACK[i], [bx, by] = CRACK[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, q = clamp(((lx - ax) * dx + (ly - ay) * dy) / L2, 0, 1), dd = Math.hypot(lx - ax - q * dx, ly - ay - q * dy); if (dd < dmin) { dmin = dd; along = acc + q * Math.sqrt(L2); } acc += Math.sqrt(L2); }
        const bd = Math.hypot(lx - 3 - (ly + 4) * -0.6, 0) + 0, br = ly > -6 && ly < 2 && Math.abs(lx - (6 - (ly + 6) * 0.9)) < 0.5 * crack;
        if ((dmin < 0.5 + crack * 1.3 && along < crack * 60) || br) c = dmin < 0.45 + crack * 0.5 ? (crack > 0.5 ? 75 : 74) : 70; }
      if (o.eye4 > 0) { const dx = lx - 10.5, dy = ly + 13, eh = 5.5 * o.eye4, inn = (dx * dx) / (2.4 * o.eye4) ** 2 + (dy * dy) / (eh * eh); if (inn < 1) c = Math.abs(dx) < 0.6 ? 22 : inn < 0.6 ? 75 : 76; }
      // the smile: a hairline split from cheek to cheek that curls upward; the grin opens it onto night and starlight teeth
      const my = 11 - (lx * lx) * 0.035 * (smile + grin), mo = grin * 7;
      if ((smile > 0 || grin > 0) && Math.abs(lx) < 13.5 * Math.max(smile, grin)) {
        if (ly > my - 0.6 && ly < my + 0.6 + mo) {
          if (mo > 1 && ly > my + 0.6 && ly < my + mo - 0.6) { const tw = Math.abs(frac(lx / 1.9) - 0.5) * 2, top = ly < my + mo / 2, depth = top ? ly - my : my + mo - ly; c = tw < 1 - depth / 2.6 ? 22 : voidFill(x, y, t, 0); }
          else c = 76;
        }
      }
      BUF[y * W + x] = c;
    }
    // the eyes burn
    if (eyes > 0.5 && o.glow !== 0 && brk < 0.3) { const ga = (o.glow === undefined ? 0.3 : o.glow) * Math.min(1.4, eyes); for (const [ex, ey] of [[-6.5, -4], [6.5, -4], [0, -16]]) glow(cx + ex * s, cy + ey * s, 7 * s * (eyes > 1 ? 1.4 : 1), T_MAG, ga); }
  }

  /* ================================================================ its powers, as screen effects */
  const T_MAG = mkTab('ff3ac8', true), T_CYAN = mkTab('40d8ff', true), T_VOIDT = mkTab('0c0418', false);
  // the colour every palette entry becomes when the world is inverted, or drained to grey
  const INV = new Uint8Array(256), GREYM = new Uint8Array(256);
  for (let i = 0; i < NPAL; i++) { const p = PAL[i]; INV[i] = nearest(255 - p[0], 255 - p[1], 255 - p[2]); const l = p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15; GREYM[i] = l > 200 ? 95 : l > 120 ? 94 : l > 60 ? 93 : l > 20 ? 92 : 0; }
  // map the frame (amt: fraction of pixels, dithered) through a table
  function mapFx(M, amt) { if (amt <= 0) return; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (amt >= 1 || bay(x, y) < amt) BUF[y * W + x] = M[BUF[y * W + x]]; }
  // REWIND: the picture tracks like a tape spun backwards: rolling bars, tearing rows, fringes, a ◀◀ in the corner
  function rewindFx(amt, t) {
    if (amt <= 0) return;
    TMP.set(BUF);
    const f = fl(t * 30), roll = (t * 900) % H;
    for (let y = 0; y < H; y++) {
      const band = Math.abs(((y + roll) % 90) - 45) < 4, tear = ih(fl(y / 2), f, 711) < 0.12 * amt ? Math.round((ih(fl(y / 2), f, 712) - 0.5) * 40 * amt) : 0;
      for (let x = 0; x < W; x++) { const sx = clamp(x - tear, 0, W - 1); let c = TMP[y * W + sx]; if (band && bay(x, y) < amt * 0.55) c = ih(x >> 1, y + f, 713) < 0.5 ? 22 : 20; BUF[y * W + x] = c; }
    }
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x++) if (bay(x, y) < amt * 0.25) BUF[y * W + x] = T_DARK[3][BUF[y * W + x]];
    if (amt > 0.3 && (f >> 3) % 2 === 0) { for (const ox of [0, 9]) for (let j = 0; j < 9; j++) for (let i = 0; i <= j && i < 9 - j; i++) { P(40 + ox + 8 - i - 4, 40 + j, 22); P(40 + ox + 8 - i - 4, 48 - j, 22); } text('REWIND', 64, 41, 22, 1); }
  }
  // KALEIDOSCOPE: the frame folded into n mirrored wedges about (cx, cy), turning
  function kaleido(cx, cy, n, rot, amt) {
    if (amt <= 0) return;
    TMP.set(BUF);
    const wedge = TAU / n;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (amt < 1 && bay(x, y) >= amt) continue;
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy); let a = Math.atan2(dy, dx) - rot;
      a = ((a % wedge) + wedge) % wedge; if (a > wedge / 2) a = wedge - a;
      const sx = clamp(fl(cx + Math.cos(a + rot) * r), 0, W - 1), sy = clamp(fl(cy + Math.sin(a + rot) * r), 0, H - 1);
      BUF[y * W + x] = TMP[sy * W + sx];
    }
  }
  // SHATTER: the frame breaks into tiles that slide and spin away from (cx, cy); the gaps are void
  function shatterFx(cx, cy, amt, t, size) {
    if (amt <= 0) return;
    TMP.set(BUF);
    const sz = size || 30;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const tx = fl(x / sz + (fl(y / sz) & 1) * 0.5), ty = fl(y / sz), mx = (tx + 0.5 - (fl(y / sz) & 1) * 0.5) * sz, my = (ty + 0.5) * sz;
      const dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) + 1, push = amt * (20 + ih(tx, ty, 721) * 40), ang = (ih(tx, ty, 722) - 0.5) * amt * 0.6;
      const lx = x - mx, ly = y - my, rx = lx * Math.cos(ang) + ly * Math.sin(ang), ry = -lx * Math.sin(ang) + ly * Math.cos(ang);
      const sx = fl(mx - dx / d * push + rx), sy = fl(my - dy / d * push + ry);
      if (Math.abs(rx) > sz / 2 - amt * 2 || Math.abs(ry) > sz / 2 - amt * 2) { BUF[y * W + x] = 76; continue; }
      BUF[y * W + x] = sx >= 0 && sy >= 0 && sx < W && sy < H ? TMP[sy * W + sx] : 76;
    }
  }
  // UNWRITE: the picture erased in falling columns, each edge chewing at it with glitch
  function unwriteFx(prog, t, fromRight) {
    if (prog <= 0) return;
    const f = fl(t * 20);
    for (let x = 0; x < W; x++) {
      const col = fl(x / 6), lim = prog * (H + 120) - ih(col, 1, 731) * 120;
      for (let y = 0; y < H; y++) {
        const yy = fromRight ? H - 1 - y : y;
        if (y < lim) BUF[yy * W + x] = (y > lim - 3 && ih(x, y + f, 732) < 0.6) ? 74 : ih(x >> 2, (y >> 2) + f, 733) < 0.03 ? 75 : 76;
      }
    }
  }
  // prism rays out of (cx, cy), turning
  function prismRays(cx, cy, n, len, rot, w, amt) {
    for (let k = 0; k < n; k++) {
      const a = rot + k * TAU / n, c = 81 + (k % 7);
      for (let r = 6; r < len; r += 1) { const sp = w * (1 - r / len); for (let q = -sp; q <= sp; q += 0.7) { const x = cx + Math.cos(a) * r - Math.sin(a) * q, y = cy + Math.sin(a) * r + Math.cos(a) * q; if (bay(fl(x), fl(y)) < amt * (1 - r / len) * 1.3) P(x, y, Math.abs(q) < sp * 0.4 ? 22 : c); } }
    }
  }
  // the four element orbs: water, leaf, lightning, starlight; orbiting (cx, cy) at radius r (k: which to draw)
  const ORB = [[45, 46, 47], [48, 49, 50], [51, 52, 53], [54, 55, 56]];
  function orbAt(x, y, k, r, t) { glow(x, y, r * 3.2, EL_T[k], 0.5); discF(x, y, r, ORB[k][1]); discF(x - r * 0.25, y - r * 0.25, r * 0.6, ORB[k][2]); P(x - r * 0.4, y - r * 0.4, 22); }
  function orbs(cx, cy, R, t, r, which, tilt) { for (let k = 0; k < 4; k++) { if (which && !which[k]) continue; const a = t * 2.4 + k * TAU / 4; orbAt(cx + Math.cos(a) * R, cy + Math.sin(a) * R * (tilt || 0.45), k, r || 3, t); } }
  // wings of light for the zenith form: layered feathers fanning out from (x, y), in prism colours
  function wings(x, y, s, t, spread) {
    for (const side of [-1, 1]) for (let k = 0; k < 9; k++) {
      const a = -PI / 2 + side * (0.35 + k * 0.17 * spread), L = (22 + k * 4 - Math.abs(k - 4) * 2) * s * spread, flap = Math.sin(t * 3 + k * 0.3) * 0.05;
      for (let r = 4 * s; r < L; r += 0.8) { const w = Math.sin(PI * r / L) * 2.2 * s; for (let q = -w; q <= w; q += 0.8) { const aa = a + flap * side, px = x + Math.cos(aa) * r - Math.sin(aa) * q, py = y + Math.sin(aa) * r * 0.9 + Math.cos(aa) * q + r * 0.25; if (bay(fl(px), fl(py)) > 0.85 + r / L * 0.1) continue; P(px, py, Math.abs(q) < w * 0.35 ? 22 : 81 + ((k + fl(t * 6)) % 7)); } }
    }
  }

  /* ================================================================ part III, the first half: dread, the tear, the words */
  const SKY_DAWN3 = [4, 5, 6, 7, 8, 19, 15, 16], SKY_VOID3 = [76, 77, 78, 79, 80, 62, 71];
  const HERO3 = (o) => Object.assign({ who: 'hero' }, o);
  const AURA_STORM = [88, 89, 90, 91], STORM_SW = [89, 90, 91, 90], SM_STORM = [89, 90, 91];
  // the morning above the clouds where part II ended; dread (0..1) slides an eclipse over the sun and drains it to violet
  function dawnSky(t, dread, ox) {
    ox = ox || 0;
    gradient(LB, 210, SKY_DAWN3);
    const sx = 352, sy = 158, ec = eio(clamp(dread * 1.4, 0, 1));
    glow(sx, sy + 18, 130 * (1 - ec * 0.7), T_WARM, 0.55 * (1 - ec));
    discF(sx, sy + 18, 24, 15); discF(sx, sy + 18, 20, 16);
    if (ec > 0) {
      // the eclipse: a black disc slides over the sun; a burning ring of corona remains
      const ex = lerp(sx + 60, sx, ec), ey = sy + 18;
      for (let a = 0; a < TAU; a += 0.02) { const r = 21 + (ec > 0.95 ? 2 + Math.sin(a * 9 + t * 3) * 1.5 : 0); P(sx + Math.cos(a) * r, ey + Math.sin(a) * r, ec > 0.95 ? 75 : 16); }
      discF(ex, ey, 20, 76);
      if (ec > 0.95) glow(sx, ey, 60, T_MAG, 0.35);
    }
    cloudBank(236, 30, 70, 351, ox + t * 10, CLOUD_GOLD, false);
    if (dread > 0) { tintAll(T_VOIDT, Math.min(0.62, dread * 0.62)); tintAll(T_MAG, dread * 0.12); }
  }
  // the Null's ashes, drifting down; from 'stop' they hang, from 'pull' they are drawn up into the sky
  function ashes(t, n, stop, pull, cx, cy) {
    for (let k = 0; k < n; k++) {
      const x0 = 40 + ih(k, 1, 31) * 380, y0 = 40 + ih(k, 2, 31) * 160, sp_ = 6 + ih(k, 3, 31) * 10;
      const tt = Math.min(t, stop), x = x0 - tt * sp_ * 0.6 + Math.sin(tt * 1.3 + k) * 4, y = y0 + tt * sp_;
      let px = x, py = y;
      if (t > pull) { const g = t - pull, u = clamp(g * g * (0.6 + ih(k, 4, 31) * 0.6), 0, 1); px = lerp(x, cx, u); py = lerp(y, cy, u); for (let q = 1; q < 5; q++) { const u2 = clamp((g - q * 0.03) ** 2 * (0.6 + ih(k, 4, 31) * 0.6), 0, 1); P(lerp(x, cx, u2), lerp(y, cy, u2), 42); } }
      rectF(px, py, 2, 2, ih(k, 5, 31) < 0.5 ? 42 : 39);
    }
  }
  // the tear: the sky ripped open from top to bottom, its paper edges curling white, night and stars inside
  function skyRift(cx, y0, y1, open, t, scale) {
    if (open <= 0) return;
    scale = scale || 1;
    glow(cx, (y0 + y1) / 2, 120 * open * scale, T_MAG, 0.35 * open);
    for (let y = Math.max(0, fl(y0)); y <= Math.min(H - 1, y1); y++) {
      const u = (y - y0) / (y1 - y0), jag = (vn(y, 0, 7 * scale, 91) - 0.5) * 30 * scale + (vn(y, 0, 2, 92) - 0.5) * 7 * scale;
      const w = open * (1 - Math.pow(Math.abs(u - 0.5) * 2, 3)) * 100 * scale + 1, xl = cx + jag - w, xr = cx + jag + w * (0.9 + vn(y, 5, 9, 93) * 0.2);
      for (let x = Math.max(0, fl(xl - 4)); x <= Math.min(W - 1, xr + 4); x++) {
        const i = y * W + x;
        if (x < xl - 3 || x > xr + 3) continue;
        if (x < xl || x > xr) { BUF[i] = (x < xl - 1.5 || x > xr + 1.5) ? 67 : 64; continue; }                // the torn paper edge
        BUF[i] = voidFill(x, y, t, 0);
      }
    }
    // flakes of torn sky falling away from the edges
    for (let k = 0; k < 40 * open; k++) { const u = frac(ih(k, 1, 94) + t * 0.3), y = lerp(y0, y1, ih(k, 2, 94)) + u * 60, side = ih(k, 3, 94) < 0.5 ? -1 : 1, x = cx + side * (70 * open * scale + 10 + u * 50); if (bay(fl(x), fl(y)) > 1 - u) continue; rectF(x, y, 2 + (k % 3), 2, k & 1 ? 64 : 19); }
  }
  // a giant porcelain hand, fingers curled over an edge (gripping); dir: +1 the fingers reach right, -1 left
  function giantHand(x, y, s, dir, curl, t) {
    // the forearm: night with a magenta rim, coming in from behind the hand
    thick(x - dir * 4 * s, y + 6 * s, x - dir * 34 * s, y + 34 * s, 9 * s + 2, 73); thick(x - dir * 4 * s, y + 6 * s, x - dir * 34 * s, y + 34 * s, 9 * s, 77);
    // the palm, outlined and shaded; four fingers reaching (and curling with curl); a thumb
    discF(x, y, 9 * s + 1.5, 69); discF(x, y, 9 * s, 66); discF(x - dir * 1.5 * s, y - 2 * s, 7 * s, 65); discF(x - dir * 3 * s, y - 4 * s, 3 * s, 64);
    const a0 = dir > 0 ? 0 : PI;
    for (let f = 0; f < 4; f++) fingerChain(x + dir * 5 * s, y - 7 * s + f * 4.6 * s, a0 - dir * (0.25 - f * 0.17), [(7 - Math.abs(f - 1.5)) * s, 5.5 * s, 4 * s], 1.9 * s - Math.abs(f - 1.5) * 0.2 * s, dir * (0.2 + curl * 0.9));
    fingerChain(x + dir * 2 * s, y + 7 * s, a0 + dir * 1.1, [5 * s, 4 * s], 2 * s, dir * (0.3 + curl * 0.6));
  }


  // 1 — dawn, after (0:00): where part II ended; the hero floats above the clouds; the Null's ashes drift down
  shot(0, 4.0, (lt, t) => {
    dawnSky(t, 0, 0);
    ashes(t, 50, 99, 99, 0, 0);
    const hy = 122 + Math.sin(t * 1.6) * 4;
    actor(HERO3({ eyes: blinkN(t) ? 'closed' : 'normal', sword: -1.0 }), 300, hy, 2.2, 0, true);
    aura(t, AURA_GOLD, 1.5, { sparks: 3 });
    cam(1.08 + 0.05 * eio(lt / 4), 0, 270, 140);
    fadeIn(lt, 0.9);
  });
  const blinkN = (t) => frac(t / 2.7) < 0.05;
  const fadeIn = (lt, d) => { if (lt < d) tintAll(T_DARK, 1 - lt / d); };
  CAPS.push([0.3, 1.9, 'n', '', 'THE NULL WAS GONE.'], [2.1, 3.9, 'n', '', 'BUT IT WAS NEVER ALONE.']);

  // 2 — dread (0:04): the ashes stop, hang, and are drawn up into the sky; the sun goes out; the hero turns and looks up
  shot(4.0, 7.0, (lt, t) => {
    const dread = sstep(0.4, 2.6, lt);
    dawnSky(t, dread, 0);
    ashes(t - 4 + 4, 50, 4.4, 5.0, 240, -40);
    const turn = lt > 1.2, hy = 122 + Math.sin(t * 1.6) * 4 * (1 - dread);
    actor(HERO3({ eyes: lt > 1.0 ? 'wide' : 'normal', sword: lt > 1.6 ? -0.5 : -1.0, sq: lt > 1.0 && lt < 1.1 ? -0.25 : 0 }), 300, hy, 2.2, lt > 2.2 ? -0.18 : 0, !turn);
    if (lt > 2.4) shk(lin(2.4, 3, lt) * 2);
    // a breath before it: everything holds still for the last moment
    cam(1.13 + 0.12 * eio(lin(1.5, 3, lt)), 0, 280 - 20 * eio(lin(1.5, 3, lt)), 140 - 30 * eio(lin(1.5, 3, lt)));
  });

  // 3 — the tear (0:07): the sky rips open top to bottom; huge pale fingers come through and pull it wide
  shot(7.0, 10.5, (lt, t) => {
    const open = eoc(lin(0, 0.5, lt)) * 0.45 + eio(lin(1.0, 3.0, lt)) * 0.55;
    gradient(LB, 210, SKY_DAWN3); tintAll(T_VOIDT, 0.62); tintAll(T_MAG, 0.12);
    cloudBank(236, 30, 70, 351, t * 10 + lt * 30, CLOUD_GOLD, false); tintAll(T_VOIDT, 0.5);
    skyRift(240, LB - 10, 230, open, t, 1);
    const grip = eoc(lin(0.9, 1.6, lt)), pull = eio(lin(1.0, 3.0, lt)) * 0.55 + 0.45 * eoc(lin(0, 0.5, lt));
    if (grip > 0) for (const [dir, y] of [[1, 76], [-1, 100], [1, 150], [-1, 172]]) { const w = pull * 100 * (1 - Math.pow(Math.abs((y - 110) / 120) * 2, 3)); giantHand(240 + (dir > 0 ? -w - 22 : w + 22) + (vn(y, 0, 7, 91) - 0.5) * 30, y, 1.6, -dir, grip, t); }
    // the hero, tiny, on the cloud tops
    actor(HERO3({ eyes: 'wide', sword: -0.5 }), 120, 200, 1, 0, false);
    if (lt < 0.5) { hitFx(240, 120, lt, 2, [22, 75]); shockRing(240, 130, 20 + lt * 700, 10 + lt * 300, 5, [75, 73, 22], 1 - lt * 2); }
    shk(lt < 0.6 ? 6 * (1 - lt / 0.6) : 1.5 * grip * (1 - lin(2.5, 3.5, lt)));
    cam(1 + 0.12 * Math.exp(-lt * 3), 0, 240, 135);
  });
  FLASH_CUTS.push(7.0);

  // 4 — the reveal (0:10.5): it leans through the rift; the camera tilts up from the tiny hero to the mask; the eyes open
  shot(10.5, 14.0, (lt, t) => {
    const tilt = eio(lin(0.2, 2.6, lt)), camY = lerp(110, 0, tilt);
    gradient(LB, H - LB, SKY_VOID3);
    stars(t, H, 90, 41);
    skyRift(240, -40 + camY, 330 + camY, 1.6, t, 1.6);
    const by = 120 + camY + lerp(40, 0, eoc(lin(0, 1.8, lt))), eyes = lt < 1.0 ? 0 : lt < 1.6 ? eoc(lin(1.0, 1.6, lt)) : 1 + sstep(2.6, 3.0, lt);
    unmaker(240, by, 3.2, t, { eyes, halo: eoc(lin(0.3, 2.2, lt)), arms: [[-58, 28, -120, -40 + Math.sin(t) * 4, 0.9], [58, 28, 122, -30, 0.6], [-46, 40, -100, 70, 0.3], [46, 40, 104, 80, 0.4]], heart: 1 });
    // the hero in the foreground, tiny, looking up at it
    actor(HERO3({ eyes: 'wide', sword: -0.5 }), 90, 232 + camY * 0.6, 2.2, -0.15, false);
    if (lt < 0.25) flashWhite(1 - lt / 0.25);
    if (lt > 1.0 && lt < 1.3) { shk(4); for (const ex of [-6.5, 6.5, 0]) glow(240 + ex * 3.2, by + (ex ? -4 : -16) * 3.2, 40, T_MAG, 0.6 * (1 - (lt - 1) / 0.3)); }
    shk(lt < 0.6 ? 5 * (1 - lt / 0.6) : 0.8);
    cam(1 + 0.06 * lt, 0, 240, 135);
  });
  FLASH_CUTS.push(10.5);

  // 5 — the mask, close (0:14): its smile splits slowly — "So. You are the one who broke my shadow."
  shot(14.0, 17.5, (lt, t) => {
    gradient(LB, H - LB, SKY_VOID3); stars(t, H, 60, 51);
    const sm = eio(lin(0.4, 2.8, lt));
    unmaker(240, 150 + lt * 2, 5.4, t, { eyes: 1, look: [0, 0.6], smile: sm, halo: 1, body: false, heart: 0 });
    ashes(t, 24, 99, 99, 0, 0);
    cam(1.02 + lt * 0.03, 0.03 * Math.sin(lt * 0.6), 240, 135);
  });
  CAPS.push([14.1, 17.4, 's', 'UNMAKER', 'SO. YOU ARE THE ONE WHO BROKE MY SHADOW.']);

  // 6 — the hero, close (0:17.5): small against all that, and not backing down — "Who... are you?"
  shot(17.5, 20.0, (lt, t) => {
    gradient(LB, H - LB, [76, 77, 78, 71, 72]);
    for (let k = 0; k < 30; k++) { const u = frac(ih(k, 1, 61) + t * 0.2); rectF(ih(k, 2, 61) * W, LB + u * 220, 2, 2, ih(k, 3, 61) < 0.5 ? 42 : 73); }
    glow(240, 300, 220, T_MAG, 0.4);
    const grip = lt > 1.4;
    const a = actor(HERO3({ eyes: lt < 0.4 ? 'wide' : 'angry', sword: grip ? -1.25 : -2.2, shade: true, mouth: lt > 0.5 && lt < 1.4 ? 1 : 0 }), 230, 176, 7, 0, false);
    if (grip && lt < 1.7) { const u = (lt - 1.4) / 0.3; sparkle(lerp(a.hand[0], a.tip[0], 0.3 + u * 0.7), lerp(a.hand[1], a.tip[1], 0.3 + u * 0.7), 9 * Math.sin(PI * u), 22, 59); }
    cam(1 + 0.04 * lt, 0, 230, 140);
  });
  CAPS.push([17.6, 19.9, 's', 'HERO', 'WHO... ARE YOU?']);

  // 7 — "I am what is left when every story ends." (0:20): its arms open, and below it the world loses its colour
  shot(20.0, 24.0, (lt, t) => {
    const drain = eio(lin(0.6, 3.4, lt));
    gradient(LB, H - LB, SKY_VOID3); stars(t, 150, 70, 71);
    cloudBank(248, 40, 70, 352, t * 8, CLOUD_GOLD, false);
    // the drain: from the middle outward, the clouds go grey and then blank, in ragged columns
    for (let y = 190; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.abs(x - 240) / 240 + (ih(x >> 2, 0, 81) - 0.5) * 0.2; if (d < drain) BUF[y * W + x] = d < drain - 0.25 ? (ih(x >> 1, y >> 1, fl(t * 12)) < 0.02 ? 95 : 93) : GREYM[BUF[y * W + x]]; }
    const open = eio(lin(0.2, 1.6, lt)), ew = lt > 3.1 ? 2 : 1;
    unmaker(240, 96, 2.4, t, { eyes: ew, smile: 1, halo: 1, arms: [[-58, 28, lerp(-80, -150, open), lerp(40, -10, open), open], [58, 28, lerp(80, 150, open), lerp(40, -10, open), open]] });
    if (lt > 3.1 && lt < 3.4) shk(3);
    cam(1.04 - 0.04 * lt / 4, 0, 240, 135);
  });
  CAPS.push([20.1, 23.9, 's', 'UNMAKER', 'I AM WHAT IS LEFT WHEN EVERY STORY ENDS.']);

  // 8 — "Then I'll write a new one." (0:24): the gold of Fable Mode catches fire around the hero; the sword comes up
  shot(24.0, 27.0, (lt, t) => {
    gradient(LB, H - LB, SKY_VOID3); stars(t, H, 60, 81);
    unmaker(330, 70, 2.6, t, { eyes: 1, smile: 1, halo: 1, body: true, heart: 1 });
    tintAll(T_VOIDT, 0.35);                                   // it stands far behind, in shadow
    const ign = eoc(lin(0.15, 0.7, lt)), sw = lerp(-1.6, -0.85, eob(lin(0.9, 1.3, lt)));
    actor(HERO3({ eyes: ign > 0.3 ? 'glow' : 'angry', sword: sw, swordCols: ign > 0.5 ? GOLD_SW : undefined, shade: true }), 150, 178, 4.2, 0, false);
    aura(t, AURA_GOLD, 2 + ign * 12, { sparks: Math.round(ign * 24) });
    if (lt > 0.15 && lt < 0.45) { shockRing(150, 178, 10 + (lt - 0.15) * 500, 6 + (lt - 0.15) * 200, 3, [60, 59, 58], 1 - (lt - 0.15) * 3); shk(2); }
    glow(150, 178, 100 * ign, T_GOLD, 0.35);
    cam(1.05 + 0.05 * eio(lt / 3), 0, 190, 150);
  });
  CAPS.push([24.2, 26.9, 's', 'HERO', "THEN I'LL WRITE A NEW ONE."]);

  // 9 — "Everything ends." (0:27): the grin opens; then its name, slammed across the frame
  shot(27.0, 30.0, (lt, t) => {
    gradient(LB, H - LB, SKY_VOID3); stars(t, H, 60, 91);
    const gr = eio(lin(0.1, 1.2, lt));
    unmaker(240, 150, 5.4, t, { eyes: lt > 1.0 ? 2 : 1, smile: 1, grin: gr, halo: 1, body: false, heart: 0, shake: lt > 1.5 ? 2 : 0 });
    if (lt > 1.5) {
      // THE UNMAKER, slammed: the frame darkens, the letters land big then settle, torn by glitch
      const g = lt - 1.5; tintAll(T_DARK, 0.55);
      const s = 'THE UNMAKER', sc = g < 0.08 ? 7 : 6, w = textWidth(s, sc), x0 = 240 - w / 2, y0 = 112 - 3.5 * sc;
      for (const [dx, c] of [[-3, 71], [3, 61]]) text(s, x0 + dx, y0, c, sc);
      text(s, x0, y0, (i, j) => (j < 2 ? 22 : j < 5 ? 75 : 73), sc, 76);
      glitchBand(t, y0, y0 + 7 * sc, 10 * Math.exp(-g * 3) + 2);
      if (g < 0.4) shk(6 * (1 - g / 0.4));
      if (g < 0.067) impactFrame(240, 112, 0);
    }
    cam(1 + 0.04 * lt, 0, 240, 135);
  });
  FLASH_CUTS.push(28.5);
  CAPS.push([27.1, 28.4, 's', 'UNMAKER', 'EVERYTHING ENDS.']);
  // rows of the frame torn sideways (a glitch across a band)
  function glitchBand(t, y0, y1, amp) {
    const f = fl(t * 20);
    for (let y = Math.max(0, fl(y0)); y < Math.min(H, y1); y++) { if (ih(y >> 1, f, 97) > 0.35) continue; const sh = Math.round((ih(y >> 1, f, 98) - 0.5) * 2 * amp); if (!sh) continue; TMP.set(BUF.subarray(y * W, y * W + W), 0); for (let x = 0; x < W; x++) BUF[y * W + x] = TMP[clamp(x - sh, 0, W - 1)]; }
  }

  /* ================================================================ part III, round one: rewind, storm, and everything taken */
  // the sky of the fight: the eclipse burning over a violet cloud sea; camY lifts the horizon (the hero falls or rises)
  function battleSky(t, camY, ox) {
    camY = camY || 0; ox = ox || 0;
    gradient(LB, H - LB, SKY_VOID3); stars(t, H, 70, 211);
    const ey = 70 + camY * 0.2; glow(400, ey, 70, T_MAG, 0.3); for (let a = 0; a < TAU; a += 0.02) { const r = 17 + Math.sin(a * 9 + t * 3) * 1.4; P(400 + Math.cos(a) * r, ey + Math.sin(a) * r, 75); } discF(400, ey, 15, 76);
    cloudBank(226 + camY, 30, 70, 351, ox + t * 14, CLOUD_GOLD, false); tintAll(T_VOIDT, 0.45); tintAll(T_MAG, 0.08);
  }
  // a ring of floating glyph tiles (the binding): radius r, tilt, turning
  function glyphRing(cx, cy, r, tilt, t, dir, cracked) {
    const n = Math.max(10, fl(r / 4));
    for (let a = 0; a < TAU; a += 1.2 / Math.max(8, r)) { const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * tilt; P(x, y, Math.sin(a) > 0 ? 74 : 72); }
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU + t * dir, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * tilt, front = Math.sin(a) > 0;
      rectF(x - 2, y - 2, 4, 4, front ? 76 : 77); rectF(x - 1, y - 1, 2, 2, front ? 75 : 73);
      if (cracked && ih(k, 1, 221) < cracked) { lineP(x - 3, y - 3, x + 3, y + 3, 22); }
    }
  }
  // the hero in gold, storm or drained, with its aura
  function heroForm(form, o, x, y, S, ang, flip, opt) {
    const F = form === 'storm' ? { form: 'storm', swordCols: STORM_SW } : form === 'gold' ? { swordCols: GOLD_SW } : form === 'grey' ? { form: 'grey' } : {};
    const a = actor(HERO3(Object.assign({}, F, o)), x, y, S, ang, flip, opt);
    if (form === 'gold') aura(T_NOW, AURA_GOLD, 3 * S, { sparks: 10 });
    if (form === 'storm') { aura(T_NOW, AURA_STORM, 3 * S, { sparks: 14 }); for (let k = 0; k < 2; k++) { const f = fl(T_NOW * 15), a0 = ih(k, f, 231) * TAU, r0 = 8 * S, r1 = 16 * S; bolt(x + Math.cos(a0) * r0, y + Math.sin(a0) * r0, x + Math.cos(a0 + 0.6) * r1, y + Math.sin(a0 + 0.6) * r1, f + k, 1, 91, 89); } }
    return a;
  }

  // 10 — round one (0:30): the hero charges in gold; it lifts one finger, and the charge plays backwards: REWIND
  const CHARGE = (u) => [lerp(70, 296, eic(u) * 0.35 + u * 0.65), lerp(176, 104, u) - Math.sin(u * PI) * 30];
  shot(30.0, 33.0, (lt, t) => {
    battleSky(t, 0, lt * 40);
    const fing = eoc(lin(1.2, 1.5, lt));
    unmaker(372, 92, 2.0, t, { eyes: lt > 1.5 ? 2 : 1, smile: 1, halo: 1, arms: [[-58, 28, lerp(-70, -120, fing), lerp(40, -40, fing), 0.1], [58, 28, 90, 50, 0.3]] });
    // the charge (story time u runs forward, then backward through the rewind, then holds)
    const rw = lt > 1.5 && lt < 2.55, u = lt < 0.25 ? 0 : lt < 1.5 ? (lt - 0.25) / 1.25 : rw ? Math.max(0, 1 - (lt - 1.5) / 0.9) : 0;
    const [x, y] = CHARGE(clamp(u, 0, 0.92)), after = [];
    if (lt > 0.25 && lt < 2.55) for (let k = 1; k <= 3; k++) { const [ax, ay] = CHARGE(clamp(u + (rw ? 1 : -1) * k * 0.05, 0, 0.92)); after.push([ax, ay, 59, 0.5 - k * 0.12]); }
    const crouch = lt < 0.25 ? 0.5 : 0;
    heroForm('gold', { eyes: lt > 2.55 ? 'wide' : 'glow', sword: lt < 0.25 ? -2.4 : rw ? -0.3 : 0.2, sq: crouch, mouth: lt > 2.6 ? 1 : 0 }, x, y + crouch * 6, 2.2, lt > 0.25 && lt < 1.5 ? 0.25 : 0, false, { after });
    if (lt > 0.25 && lt < 1.5) streaks(-0.3, 30, t, 2000, 59, 70, 241, [0, LB, W, H - 2 * LB]);
    if (lt > 1.45 && lt < 1.6) { glow(372 - 120 * 2, 92 - 40 * 2 + 20, 30, T_MAG, 0.8); }
    rewindFx(rw ? 1 : lt > 2.55 && lt < 2.7 ? 0.4 : 0, t);
    cam(1.04, 0, 240, 135);
  });
  CAPS.push([32.65, 33.0, 's', 'HERO', '...WHAT?']);

  // 11 — the hand (0:33): three cuts across a giant porcelain hand — the wounds close as fast as they open — then it swats
  const HAND_HITS = [33.6, 34.2, 34.8], HAND_PTS = [[250, 120], [300, 150], [270, 95]];
  shot(33.0, 36.5, (lt, t) => {
    battleSky(t, -20, 0);
    const swat = lin(35.45, 35.65, t), hx = lerp(330, 160, eic(swat)), hy = lerp(132, 150, swat);
    giantHand(hx, hy, 4.2, -1, 0.15 + swat * 0.6, t);
    if (swat > 0 && swat < 1) streaks(PI, 30, t, 3000, 66, 120, 251, [0, 60, W, 160]);
    // the wounds: white gashes that seal over
    HAND_HITS.forEach((h, k) => { const g = t - h; if (g < 0 || g > 0.6 || swat > 0) return; const [px, py] = HAND_PTS[k], L = 40 * (1 - g / 0.6); thick(px - L * 0.7, py - L * 0.5, px + L * 0.7, py + L * 0.5, 3, g < 0.2 ? 22 : 74); });
    // the hero dashing across it, cut after cut
    let hp = [120, 150], ang = 0, sw = -0.6;
    for (let k = 0; k < 3; k++) { const h = HAND_HITS[k], from = k === 0 ? [120, 150] : HAND_PTS[k - 1].map((v, i) => v + (i ? -30 : 60)), to = HAND_PTS[k].map((v, i) => v + (i ? -30 : 60)); if (t >= h - 0.25 && t < h + 0.35) { const u = eoc(lin(h - 0.25, h + 0.05, t)); hp = [lerp(from[0], to[0], u), lerp(from[1], to[1], u)]; sw = lerp(-2.2, 1.0, u); ang = (k % 2 ? -0.3 : 0.3); } else if (t >= h + 0.35) hp = to; }
    let hidden = false;
    if (t > 35.6) { const g = t - 35.6; hp = [lerp(hp[0], 40, eoc(g * 3)), lerp(hp[1], 330, eic(g * 1.5))]; ang = g * 14; hidden = g > 0.6; }
    if (!hidden) heroForm('gold', { eyes: t > 35.6 ? 'closed' : 'glow', sword: sw }, hp[0], hp[1], 2.2, ang, false);
    HAND_HITS.forEach((h, k) => hitFx(HAND_PTS[k][0], HAND_PTS[k][1], t - h, 0.8, [22, 59]));
    hitFx(200, 150, t - 35.6, 1.6, [22, 75]);
    let z = 1.04; for (const h of HAND_HITS) { const g = t - h; if (g > 0) z += 0.06 * Math.exp(-g * 10); }
    cam(z, 0, 240, 135);
  });
  WHIPS.push([35.75, PI / 2]);

  // 12 — it turns the world over (0:36.5): the cloud sea falls upward into the sky; rings of glyphs close round the tumbling hero
  shot(36.5, 40.0, (lt, t) => {
    gradient(LB, H - LB, SKY_VOID3); stars(t, H, 70, 261);
    unmaker(240, 54, 1.4, t, { eyes: 2, smile: 1, halo: 1, body: false, glow: 0.5 });
    for (let k = 0; k < 22; k++) { const sp_ = 140 + ih(k, 1, 262) * 160, y = H + 40 - ((lt * sp_ + ih(k, 2, 262) * 400) % 400); cloudPuff(ih(k, 3, 262) * W, y, 12 + ih(k, 4, 262) * 22, CLOUD_GOLD, 263 + k); }
    tintAll(T_VOIDT, 0.4);
    streaks(-PI / 2, 40, t, 2400, 20, 70, 264, [0, LB, W, H - 2 * LB]);
    const hx = 240 + Math.sin(lt * 1.3) * 20, hy = 160 - lt * 8, close = eio(lin(1.3, 3.4, lt));
    for (let k = 0; k < 3; k++) glyphRing(hx, hy, lerp(140 + k * 30, 22 + k * 6, close), [0.35, 0.8, 0.2][k], t, k & 1 ? -1.4 : 1.1, 0);
    heroForm('gold', { eyes: lt < 2 ? 'closed' : 'angry', sword: -0.4 }, hx, hy, 2.2, lt < 2.2 ? lt * 3 : 6.6 + Math.sin(lt * 9) * 0.05, false);
    shk(close * 1.5);
    cam(1 + close * 0.25, 0, hx, hy, 240, 140);
  });

  // 13 — STORM FORM (0:40): bound tight, the hero strains; the rings crack with light, and burst. Electric blue.
  shot(40.0, 44.0, (lt, t) => {
    const burstT = 2.0, g = lt - burstT;
    gradient(LB, H - LB, SKY_VOID3); stars(t, H, 60, 271);
    if (g < 0) {
      const strain = lin(0, 2, lt);
      tintAll(T_DARK, lin(1.6, 2, lt) * 0.5);
      for (let k = 0; k < 3; k++) glyphRing(240, 150, 84 + k * 12, [0.35, 0.8, 0.2][k], t, k & 1 ? -1.4 : 1.1, sstep(0.6, 1.9, lt));
      heroForm('gold', { eyes: lt < 1 ? 'closed' : 'glow', sword: -0.4, vib: 1 }, 240, 150, 4, 0, false, {});
      glow(240, 150, 30 + strain * 60, T_CYAN, strain * 0.5);
      for (let k = 0; k < fl(strain * 6); k++) { const f = fl(t * 15), a = ih(k, f, 272) * TAU; bolt(240, 150, 240 + Math.cos(a) * 70, 150 + Math.sin(a) * 50, f + k, 1, 91, 90); }
      shk(strain * 2.5);
      cam(1.1 + strain * 0.15, 0, 240, 150);
    } else {
      // the burst: the rings fly apart in pieces; lightning everywhere; and there it is
      for (let k = 0; k < 40; k++) { const a = ih(k, 1, 273) * TAU, r = 30 + g * (200 + ih(k, 2, 273) * 300); rectF(240 + Math.cos(a) * r, 150 + Math.sin(a) * r * 0.6, 4, 4, k & 1 ? 75 : 76); }
      for (let k = 0; k < 8; k++) { const f = fl(t * 15), a = ih(k, f, 274) * TAU; bolt(240, 150, 240 + Math.cos(a) * 260, 150 + Math.sin(a) * 160, f + k * 7, 2, 91, 89, 0.3); }
      glow(240, 150, 120, T_CYAN, 0.3 * Math.max(0.2, 1 - g * 1.5));
      heroForm('storm', { eyes: 'glow', sword: g < 0.6 ? -1.2 : -0.9, sq: g < 0.08 ? -0.3 : 0 }, 240, 150, 4.4, 0, false);
      shockRing(240, 150, 20 + g * 600, 10 + g * 260, 5, [91, 90, 22], 1 - g * 1.5);
      if (g < 0.12) { flashWhite(1 - g / 0.12); } else if (g < 0.2) impactFrame(240, 150, 1);
      shk(g < 0.6 ? 6 * (1 - g / 0.6) : 1);
      cam(1.25 - 0.15 * eoc(lin(0, 0.5, g)) + 0.04 * Math.sin(g * 3), 0.05 * Math.exp(-g * 3), 240, 150);
    }
  });
  FLASH_CUTS.push(42.0);
  CAPS.push([42.05, 43.4, 'x', '', 'STORM FORM!', 64]);

  // 14 — the storm blitz (0:44): lightning-fast, from everywhere at once; on the last cut, the mask cracks
  const BLITZ = [[44.5, -86, 30], [45.2, 70, 10], [45.9, -18, -4], [46.6, 40, -44], [47.3, -6, 34], [47.6, 6, -10]];
  shot(44.0, 48.0, (lt, t) => {
    battleSky(t, 0, 0);
    const BX = 240, BY = 112, S = 2.6;
    let shakeB = 0, crack = 0;
    for (const [h] of BLITZ) { const g = t - h; if (g > 0 && g < 0.3) shakeB = Math.max(shakeB, 5 * (1 - g / 0.3)); }
    if (t > 47.6) crack = eoc(lin(47.6, 47.95, t));
    unmaker(BX, BY, S, t, { eyes: t > 47.6 ? 2 : 1, smile: t < 46 ? 1 : 0.6, halo: 1, crack, shake: shakeB, arms: [[-58, 28, -110, 20, 0.6], [58, 28, 116, 30, 0.8]] });
    // the hero: a bolt from strike to strike, appearing at each one mid-cut
    let prev = [40, 220];
    for (let k = 0; k < BLITZ.length; k++) {
      const [h, lx, ly] = BLITZ[k], p = [BX + lx * S, BY + ly * S], g = t - h;
      if (g > -0.12 && g < 0.06) bolt(prev[0], prev[1], p[0], p[1], k * 13 + fl(t * 30), 2, 91, 89, 0.25);
      if (g >= -0.04 && g < (k + 1 < BLITZ.length ? BLITZ[k + 1][0] - h - 0.12 : 0.6)) { const u = clamp((g + 0.04) / 0.12, 0, 1); heroForm('storm', { eyes: 'glow', sword: lerp(-2.4, 1.2, eoc(u)) * (k % 2 ? -1 : 1) }, p[0] + (k % 2 ? 22 : -22), p[1] - 10, 2.2, 0, !!(k % 2)); }
      hitFx(p[0], p[1], g, k === BLITZ.length - 1 ? 2 : 0.9, [22, 91]);
      prev = p;
    }
    if (t < 44.5) { const u = lin(44.0, 44.4, t); heroForm('storm', { eyes: 'glow', sword: -2.4, sq: 0.4 }, 40 + u * 10, 220 - u * 10, 2.2, 0, false); }
    if (t > 47.6 && t < 47.67) impactFrame(BX, BY, 0);
    let z = 1.02, r = 0; for (const [h] of BLITZ) { const g = t - h; if (g > 0) { z += 0.05 * Math.exp(-g * 10); } }
    if (t > 47.6) { r = 0.07 * Math.exp(-(t - 47.6) * 4); z += 0.12 * Math.exp(-(t - 47.6) * 5); }
    cam(z, r, BX, BY);
  });

  // 15 — it laughs (0:48): the crack opens into a fourth eye; then the world shatters into a kaleidoscope of its face
  shot(48.0, 51.0, (lt, t) => {
    gradient(LB, H - LB, SKY_VOID3); stars(t, H, 70, 281);
    const ha = lt < 1.6 ? (fl(t * 10) % 2 ? 2 : -2) : 0;
    unmaker(240, 150 + ha, 4.6, t, { eyes: 2, crack: 1, eye4: eoc(lin(0.3, 1.0, lt)), grin: 0.7 + 0.3 * Math.abs(Math.sin(t * 10)), halo: 1, body: false, heart: 0, shake: lt < 1.6 ? 3 : 0 });
    if (lt > 0.3 && lt < 1.0) glow(240 + 10.5 * 4.6, 150 - 13 * 4.6, 50, T_MAG, 0.5);
    const k = eio(lin(1.5, 1.9, lt));
    if (k > 0) kaleido(240, 135, 8, t * 0.6, k);
    if (lt > 2.6) shatterFx(240, 135, eic(lin(2.6, 3.0, lt)) * 3, t, 34);
    shk(lt < 1.6 ? 2 : 1);
    cam(1 + 0.06 * lt, 0.02 * Math.sin(t * 2), 240, 135);
  });
  CAPS.push([48.2, 49.6, 's', 'UNMAKER', 'HA. HA. HA.']);

  // 16 — UNWRITE (0:51): a beam from its eyes takes the colour out of everything it touches, and pulls the four elements out
  //      of the hero one by one — water, leaf, lightning, starlight — into its grinning mouth
  const RIP = [52.0, 52.8, 53.6, 54.4];
  shot(51.0, 55.0, (lt, t) => {
    battleSky(t, 0, 0);
    const BX = 330, BY = 82, S = 2.2, MX = BX, MY = BY + 13 * S;
    unmaker(BX, BY, S, t, { eyes: 2, crack: 1, eye4: 1, grin: 1, halo: 1, arms: [[-58, 28, -100, 10, 0.8], [58, 28, 100, 40, 0.5]] });
    let kick = 0; for (const h of RIP) { const g = t - h; if (g > 0) kick += 6 * eoc(clamp(g / 0.15, 0, 1)) - (g > 0.15 ? 0 : 0); }
    const HX = 120 - kick, HY = 176 + kick * 0.3, drained = lin(51.6, 54.6, t), on = eoc(lin(0, 0.35, lt));
    // the beam, and everything inside it inverted
    const x0 = BX - 3, y0 = BY - 6, dx = HX - x0, dy = HY - y0, L = Math.hypot(dx, dy);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const px = x - x0, py = y - y0, u = (px * dx + py * dy) / (L * L), d = Math.abs(-px * dy + py * dx) / L; if (u > 0 && u < on * 1.05 && d < 16 + u * 10) BUF[y * W + x] = INV[BUF[y * W + x]]; }
    beam(x0, y0, lerp(x0, HX, on), lerp(y0, HY, on), 7, [70, 72, 74, 75], t, 3);
    // the hero, held in it, colour draining out
    heroForm(drained < 0.98 ? 'storm' : 'grey', { eyes: 'closed', sword: -0.4, vib: 2 }, HX, HY, 2.6, -0.15, false);
    if (drained > 0) { actor(HERO3({ form: 'grey', eyes: 'closed', sword: -0.4 }), HX, HY, 2.6, -0.15, false, { alpha: drained }); }
    // the elements, torn out one at a time and swallowed
    RIP.forEach((h, k) => {
      const g = t - h; if (g < 0) return;
      if (g < 0.25) { glow(HX, HY, 60, EL_T[k], 0.8 * (1 - g / 0.25)); burst(HX, HY, g / 0.25, 60, 12, k, [ORB[k][2], ORB[k][1]], 3); shk(3); }
      const u = eio(clamp(g / 0.65, 0, 1)); if (u >= 1) return;
      const ox = lerp(HX, MX, u), oy = lerp(HY, MY, u) - Math.sin(u * PI) * 30;
      for (let q = 1; q < 8; q++) { const u2 = eio(clamp((g - q * 0.03) / 0.65, 0, 1)); rectF(lerp(HX, MX, u2) - 1, lerp(HY, MY, u2) - Math.sin(u2 * PI) * 30 - 1, 3, 3, ORB[k][q < 3 ? 2 : 1]); }
      orbAt(ox, oy, k, 5, t);
    });
    let z = 1.04 + 0.12 * eio(lt / 4); for (const h of RIP) { const g = t - h; if (g > 0) z += 0.07 * Math.exp(-g * 8); }
    cam(z, -0.03 * eio(lt / 4), lerp(230, 170, eio(lt / 4)), lerp(135, 150, eio(lt / 4)));
  });

  // 17 — the crush (0:55): the giant hand closes around the drained hero, squeezes — and the sword shatters
  shot(55.0, 57.0, (lt, t) => {
    gradient(LB, H - LB, [76, 77, 78, 92, 93]);
    mapFx(GREYM, 0.4);
    const close = eio(lin(0.1, 0.9, lt)), sq = lt > 0.9 && lt < 1.5 ? 1 : 0, g = lt - 1.5;
    const CX = 250, CY = 140;
    // the hero inside, small and grey
    if (close < 0.95) actor(HERO3({ form: 'grey', eyes: 'closed', sword: -0.7 }), CX - 20, CY + 4, 3.4, 0.2, false);
    // the palm, and four fingers curling over and round the hero, the thumb closing from below
    discF(CX + 96, CY + 8, 74, 69); discF(CX + 96, CY + 8, 72, 66); discF(CX + 88, CY, 60, 65); discF(CX + 78, CY - 14, 30, 64);
    for (let f = 0; f < 4; f++) fingerChain(CX + 54, CY - 66 + f * 36, PI + 0.25 - f * 0.12, [44 - Math.abs(f - 1.5) * 4, 36, 26], 15 - Math.abs(f - 1.5), 0.25 + close * 0.85 + (f > 1 ? -0.1 : 0));
    fingerChain(CX + 60, CY + 96, -PI * 0.75, [40, 30], 15, -0.2 - close * 0.6);
    if (sq) shk(3);
    if (g > 0) {
      // the sword's shards, bursting out between the fingers
      for (let k = 0; k < 26; k++) { const a = -PI * 0.2 - ih(k, 1, 291) * PI * 1.2, v = 120 + ih(k, 2, 291) * 260, x = CX - 20 + Math.cos(a) * v * g, y = CY + Math.sin(a) * v * g + 120 * g * g, rot = g * (8 + k); thick(x, y, x + Math.cos(rot) * 7, y + Math.sin(rot) * 7, 2, k % 3 ? 34 : 22); }
      if (g < 0.067) impactFrame(CX - 20, CY, 1); else if (g < 0.13) impactFrame(CX - 20, CY, 0);
      shk(7 * Math.exp(-g * 5));
    }
    mapFx(GREYM, 0.4 + lin(0, 2, lt) * 0.5);
    cam(1.05 + 0.15 * eio(lin(0, 1.5, lt)), 0, CX, CY);
  });
  FLASH_CUTS.push(56.5);
  // a giant porcelain finger: a chain of shaded, tapering segments, each turned by curl from the one before
  function fingerChain(x, y, a, lens, r, curl) {
    const pts = [[x, y, r]]; let px = x, py = y, aa = a, rr = r;
    for (const L of lens) { const n = Math.ceil(L / 2); for (let k = 1; k <= n; k++) { px += Math.cos(aa) * L / n; py += Math.sin(aa) * L / n; pts.push([px, py, rr * (1 - 0.18 * k / n)]); } rr *= 0.82; aa += curl; pts.push(null); }
    for (const pass of [0, 1, 2]) for (const q of pts) { if (!q) continue; const [qx, qy, qr] = q; if (pass === 0) discF(qx, qy, qr + 1.6, 69); else if (pass === 1) discF(qx, qy, qr, 65); else discF(qx - qr * 0.25, qy - qr * 0.3, qr * 0.45, 64); }
    // the knuckle creases
    let k = 0; for (let i = 0; i < pts.length; i++) if (!pts[i] && i > 0 && i < pts.length - 1) { const [qx, qy, qr] = pts[i - 1]; thick(qx - qr * 0.6, qy, qx + qr * 0.6, qy, 2, 67); k++; }
  }

  /* ================================================================ part III, second half (0:57–2:00): s5_finale */
  // Everything here lives in one block, so its helpers are private to it; only the shots, captions, cut-flashes and
  // whip pans escape (into SHOTS, CAPS, FLASH_CUTS, WHIPS).
  {
  const Z5B = new Uint8Array(NP), Z5C = new Uint8Array(NP);   // spare frames: dissolves, fades, split skies
  const PRISM = [81, 82, 83, 84, 85, 86, 87], ZEN_AURA = [59, 60, 22, 22], SM_PRISM = [83, 60, 22];
  const VOIDSKY = [76, 77, 78, 79, 80], GREYS = [92, 93, 94, 95], GLEV = [0, 92, 93, 94, 95], GRAW = [0, 92, 94, 95, 22];   // grey levels, and a colour that drains to each
  const SKY_BOLD = [3, 4, 5, 6, 7, 8, 13, 14, 15, 16], CLOUD_SUN = [18, 19, 15, 16], CLOUD_NEAR = [36, 13, 14, 15];
  const z5Sw = (t) => { const k = fl(t * 14) % 7; return PRISM.slice(k).concat(PRISM.slice(0, k)); };   // the blade of light
  const HEROZ = (o) => Object.assign({ who: 'hero', form: 'zenith', eyes: 'glow', fly: true }, o);

  /* -------------------------------------------------------------- helpers */
  // a dithered dissolve: draw A, keep it, draw B, then let A show through where the dither is above u
  function z5Mix(u, drawA, drawB) {
    if (u <= 0) { drawA(); return; }
    if (u >= 1) { drawB(); return; }
    drawA(); Z5B.set(BUF); drawB();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (vn(x, y, 12, 5009) * 0.85 + bay(x, y) * 0.15 >= u) BUF[y * W + x] = Z5B[y * W + x];
  }
  // a filled triangle
  function z5Tri(ax, ay, bx, by, cx, cy, c) {
    const x0 = Math.max(0, fl(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, fl(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (Math.abs(d) < 0.01) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5, w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / d, w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / d;
      if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue;
      BUF[y * W + x] = c;
    }
  }
  // a sliver of the broken blade: a long thin triangle; lit (0..1) is how squarely it faces the light
  function z5Shard(x, y, L, w, a, lit, dim) {
    const ca = Math.cos(a), sa = Math.sin(a), px = -sa * w, py = ca * w;
    const tx = x + ca * L, ty = y + sa * L, bx = x - ca * L * 0.45, by = y - sa * L * 0.45;
    z5Tri(tx, ty, bx + px, by + py, bx - px, by - py, lit > 0.85 ? 22 : dim ? 33 : 34);
    lineP(tx, ty, bx + px, by + py, lit > 0.6 ? 22 : 34);
    if (lit > 0.95) sparkle(tx, ty, 1 + (lit - 0.95) * 80, 22, 21);
  }
  // shards orbiting a point at depth; returns nothing (drawn straight in)
  const SHD = []; for (let k = 0; k < 9; k++) SHD.push({ a: k / 9 * TAU + ih(k, 1, 5001), r: 0.45 + ih(k, 2, 5001) * 0.7, L: 0.7 + ih(k, 3, 5001) * 0.7, sp: (ih(k, 4, 5001) - 0.5) * 1.8, ph: ih(k, 5, 5001) * TAU, dr: (ih(k, 6, 5001) - 0.5) * 0.2 });
  function z5Shards(cx, cy, R, S, t, gather, tx, ty) {
    // gather 0..1 pulls them in to (tx, ty), spinning faster and lining up along the blade
    for (let k = 0; k < SHD.length; k++) {
      const s = SHD[k], g = eic(clamp(gather * 1.25 - k * 0.03, 0, 1));
      const a = s.a + t * s.dr, x0 = cx + Math.cos(a) * R * s.r, y0 = cy + Math.sin(a) * R * s.r * 0.7 + Math.sin(t * 0.7 + s.ph) * 4;
      const x = lerp(x0, tx, g), y = lerp(y0, ty, g), rot = s.ph + t * s.sp + g * g * 14;
      const lit = Math.pow(Math.max(0, Math.cos(rot * 1.3 + 0.8)), 6);
      z5Shard(x, y, 4 * S * s.L * (1 - g * 0.5), Math.max(0.8, S * 0.55), rot, lit, false);
      if (g > 0.05 && g < 1) lineP(x, y, lerp(x0, tx, g * 0.6), lerp(y0, ty, g * 0.6), 60);
    }
  }
  // orbs in front of or behind their centre
  function z5Orbs(cx, cy, R, t, r, tilt, front, which, spin) {
    for (let k = 0; k < 4; k++) {
      if (which && !which[k]) continue;
      const a = t * (spin || 2.4) + k * TAU / 4, z = Math.sin(a);
      if ((z > 0) !== front) continue;
      orbAt(cx + Math.cos(a) * R, cy + z * R * tilt, k, r * (front ? 1.1 : 0.85), t);
    }
  }
  // a radiant ray (a dithered wedge) from (x, y) along a
  function z5Ray(x, y, a, len, w, c0, c1, amt) {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let r = 0; r < len; r += 1) {
      const sp = w * (0.3 + r / len), lim = amt * Math.min(1, (1 - r / len) / 0.45);
      for (let q = -sp; q <= sp; q += 0.8) { const px = x + ca * r - sa * q, py = y + sa * r + ca * q; if (bay(fl(px), fl(py)) < lim) P(px, py, Math.abs(q) < sp * 0.35 ? c0 : c1); }
    }
  }
  // wings of prism light: three ranks of feathers (prism primaries, gold secondaries, white coverts) hanging from arms
  // raised either side of (x, y); s: scale, spread 0 (folded) .. 1, flap: how far they beat
  function z5Kite(bx, by, a, L, w, c) {
    const ca = Math.cos(a), sa = Math.sin(a), mx = bx + ca * L * 0.32, my = by + sa * L * 0.32, tx = bx + ca * L, ty = by + sa * L;
    z5Tri(bx, by, mx - sa * w, my + ca * w, tx, ty, c); z5Tri(bx, by, mx + sa * w, my - ca * w, tx, ty, c);
  }
  function z5Wings(x, y, s, t, spread, flap) {
    if (spread <= 0.02) return;
    const beat = Math.sin(t * 3) * (flap === undefined ? 0.07 : flap), sh = fl(t * 8);
    glow(x, y - 8 * s, 70 * s * spread, T_GOLD, 0.3 * spread);
    for (const sd of [-1, 1]) {
      const arm = -0.78 - beat + (1 - spread) * 1.3, ax = Math.cos(arm) * sd, ay = Math.sin(arm), Lw = 40 * s * (0.35 + 0.65 * spread);
      const RANKS = [[9, 1, 0], [8, 0.62, 1], [7, 0.36, 2]];
      for (const [N, len, rank] of RANKS) for (let j = N - 1; j >= 0; j--) {
        const u = (j + 0.6) / N, bx = x + ax * Lw * u, by = y + ay * Lw * u - Math.sin(u * PI) * 5 * s;
        const fr = lerp(PI / 2 - 0.12, -0.15 - beat * 1.5, Math.pow(u, 1.25)) - (1 - spread) * 0.5, fa = sd > 0 ? fr : PI - fr;
        const L = s * (15 + 30 * u) * len * (0.45 + 0.55 * spread), w = s * (4.4 - rank * 0.8);
        const fill = rank === 0 ? PRISM[(j + sh) % 7] : rank === 1 ? 60 : 22, rim = rank === 0 ? 22 : rank === 1 ? 59 : 60;
        z5Kite(bx - Math.cos(fa) * 1.2, by - Math.sin(fa) * 1.2, fa, L + 2.4, w + 1.1, rim);
        z5Kite(bx, by, fa, L, w, fill);
        if (rank === 0) lineP(bx, by, bx + Math.cos(fa) * L * 0.8, by + Math.sin(fa) * L * 0.8, 22);
      }
    }
  }
  // the zenith eyes burn cyan (the core sprite paints them prism green): recolour 84 inside the last stamp, not its outline
  function z5Eyes() {
    for (let y = Math.max(1, SMB[1]); y <= Math.min(H - 2, SMB[3]); y++) for (let x = Math.max(1, SMB[0]); x <= Math.min(W - 2, SMB[2]); x++) {
      const i = y * W + x; if (BUF[i] !== 84 || !SMASK[i]) continue;
      if (SMASK[i - 1] && SMASK[i + 1] && SMASK[i - W] && SMASK[i + W]) BUF[i] = 85;
    }
  }
  // a sunburst: n solid prism rays turning about (cx, cy) out to r1 (no dither until their ends)
  function z5Sunburst(cx, cy, n, rot, r0, r1, wf, cols) {
    cols = cols || PRISM;
    const x0 = Math.max(0, fl(cx - r1)), x1 = Math.min(W - 1, Math.ceil(cx + r1)), y0 = Math.max(LB, fl(cy - r1)), y1 = Math.min(H - LB - 1, Math.ceil(cy + r1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy); if (d < r0 || d > r1) continue;
      const v = ((Math.atan2(dy, dx) - rot) / TAU * n % n + n) % n, k = fl(v), f = Math.abs(v - k - 0.5), w = wf * (0.55 + 0.45 * d / r1);
      if (f > w) continue;
      if (d > r1 * 0.6 && bay(x, y) > (r1 - d) / (r1 * 0.4)) continue;
      BUF[y * W + x] = f < w * 0.3 ? 22 : cols[k % cols.length];
    }
  }
  // god rays: soft bands of light tinted into the picture from (cx, cy)
  function z5GodRays(cx, cy, n, rot, T, a, r1) {
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx);
      const b = Math.sin(ang * n + rot) * 0.6 + Math.sin(ang * n * 2.3 - rot * 1.7) * 0.4; if (b < 0.35) continue;
      const fo = Math.max(0, 1 - d / r1); if (fo <= 0) continue;
      tintI(y * W + x, x, y, T, a * fo * (b - 0.35) * 1.6);
    }
  }
  // the zenith hero, complete: light rays, wings, orbs behind, body, aura, orbs in front
  function z5Zenith(x, y, S, t, o) {
    o = o || {};
    const ang = o.ang || 0, sp = o.spread === undefined ? 1 : o.spread;
    if (o.rays) z5Sunburst(x, y, 14, t * 0.35, 6 * S, o.rays, 0.09);
    if (o.orbR) z5Orbs(x, y, o.orbR, t, o.orbr || S * 1.3, o.tilt || 0.38, false);
    z5Wings(x - Math.sin(ang) * 6 * S, y - Math.cos(ang) * 6 * S, S * (o.ws || 0.6), o.wt === undefined ? t : o.wt, sp, o.flap);
    const a = actor(HEROZ({ eyes: o.eyes || 'glow', mouth: o.mouth, sword: o.sw, swordCols: z5Sw(t), legs: o.legs, sq: o.sq, reach: o.reach }), x, y, S, ang, !!o.flip, { white: o.white, after: o.after });
    z5Eyes();
    aura(t, o.auraC || ZEN_AURA, o.auraR || 3 * S, { sparks: o.sparks === undefined ? 12 : o.sparks, rise: o.rise });
    if (o.orbR) z5Orbs(x, y, o.orbR, t, o.orbr || S * 1.3, o.tilt || 0.38, true);
    return a;
  }
  // a key-tracked zenith fighter (core fighter() has no forms): leans, stretches, leaves afterimages, smears its swings
  function z5Fight(keys, lt, base) {
    const p = trk(keys, lt), q = trk(keys, lt - 1 / 30), q2 = trk(keys, lt - 2 / 30);
    const vx = (p.x - q.x) * 30, vy = (p.y - q.y) * 30, sp = Math.hypot(vx, vy), S = p.S || base.S || 2;
    const lean = p.nolean ? 0 : clamp(vx / 1300, -0.45, 0.45), sq = (p.sq || 0) + (sp > 150 ? clamp((Math.abs(vx) - Math.abs(vy)) / 2400, -0.4, 0.4) : 0);
    const vib = (p.vib || 0) + FRZ, f = fl(T_NOW * 30), jx = vib ? Math.round((ih(f, 3, 601) - 0.5) * 2 * vib) : 0, jy = vib ? Math.round((ih(f, 4, 601) - 0.5) * 2 * vib) : 0;
    const ang = (p.a || 0) + lean, x = p.x + jx, y = p.y + jy, t = T_NOW;
    if (base.orbR) z5Orbs(x, y, base.orbR, t, S * 1.2, 0.4, false);
    z5Wings(x - Math.sin(ang) * 6 * S, y - Math.cos(ang) * 6 * S, S * 0.55, t * (base.flap || 1), p.spread === undefined ? 1 : p.spread, 0.12);
    const after = [];
    if (sp > 300) for (let k = 1; k <= 3; k++) { const a = trk(keys, lt - k * 0.03); after.push([a.x, a.y, k === 1 ? 22 : PRISM[(k * 2 + f) % 7], 0.6 - k * 0.14]); }
    const res = actor(HEROZ({ eyes: p.eyes || 'glow', mouth: p.mouth, sword: p.sw, swordCols: z5Sw(t), sq, reach: p.reach }), x, y, S, ang, !!p.flip, { after, white: p.white });
    z5Eyes();
    aura(t, ZEN_AURA, base.auraR || 3 * S, { sparks: 10, rise: base.rise });
    if (base.orbR) z5Orbs(x, y, base.orbR, t, S * 1.2, 0.4, true);
    if (typeof p.sw === 'number' && typeof q2.sw === 'number') {
      const sa = (p.flip ? PI - p.sw : p.sw) + ang, sa0 = (q2.flip ? PI - q2.sw : q2.sw) + (q2.a || 0) + lean;
      smearArc(res.hand[0], res.hand[1], sa0, sa, 30 * S, SM_PRISM);
    }
    return { x, y, S, hand: res.hand, tip: res.tip, p, sp };
  }
  // a whirlpool: the picture turned about (cx, cy), more the nearer it is
  function z5Swirl(cx, cy, k, r0) {
    TMP.set(BUF);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy), a = k * r0 / (d + r0 * 0.5), c = Math.cos(a), s = Math.sin(a);
      const X = clamp(fl(cx + dx * c - dy * s), 0, W - 1), Y = clamp(fl(cy + dx * s + dy * c), LB, H - LB - 1);
      BUF[y * W + x] = TMP[Y * W + X];
    }
  }
  // the colour comes back: inside radius R of (cx, cy) the world keeps its colour, outside it is drained; a prism front
  function z5Wave(cx, cy, R, hz, ysq, t) {
    for (let y = LB; y < H - LB; y++) {
      const dy = (y - cy) * (y > hz ? ysq : 1);
      for (let x = 0; x < W; x++) {
        const i = y * W + x, d = Math.sqrt((x - cx) * (x - cx) + dy * dy) + (vn(x, y, 14, 5011) - 0.5) * 18;
        if (d > R + 7) BUF[i] = GREYM[BUF[i]];
        else if (d > R) BUF[i] = d < R + 2 ? 22 : PRISM[((fl(Math.atan2(dy, x - cx) * 3 + d * 0.2 + t * 6) % 7) + 7) % 7];
        else if (d > R - 10 && bay(x, y) < (d - R + 10) / 14) BUF[i] = T_WH[3][BUF[i]];
      }
    }
  }
  // a tendril of the void: a quadratic curve from its root (bx, by) through (qx, qy) to its tip (tx, ty), rippling;
  // cut (0..1) severs it there and sends the rest flying by sev [dx, dy, age]
  function z5Tendril(bx, by, qx, qy, tx, ty, w0, t, seed, cut, sev) {
    cut = cut === undefined ? 1 : cut;
    const L = Math.hypot(qx - bx, qy - by) + Math.hypot(tx - qx, ty - qy), n = Math.max(16, fl(L / 1.6)), pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
      const x = a * bx + b * qx + c * tx, y = a * by + b * qy + c * ty;
      const dx = 2 * (1 - u) * (qx - bx) + 2 * u * (tx - qx), dy = 2 * (1 - u) * (qy - by) + 2 * u * (ty - qy), dl = Math.hypot(dx, dy) || 1;
      const rip = Math.sin(u * 10 - t * 11 + seed) * 7 * u * (1 - u) * 2;
      let px = x - dy / dl * rip, py = y + dx / dl * rip, r = w0 * (1 - u * 0.68) + 0.8, keep = true;
      if (u > cut) { if (!sev) keep = false; else { const g = sev[2]; px += sev[0] * g + Math.sin(u * 6) * g * 20; py += sev[1] * g + 160 * g * g; r *= Math.max(0, 1 - g * 1.6); keep = r > 0.5 && ih(i, fl(t * 30), seed) > g * 1.4; } }
      if (keep) pts.push([px, py, r, u]);
    }
    for (const [x, y, r] of pts) discF(x, y, r + 1.4, 73);
    for (const [x, y, r] of pts) discF(x, y, r, 77);
    for (const [x, y, r, u] of pts) { if (r > 2.5) discF(x - r * 0.25, y - r * 0.3, r * 0.4, 78); if (fl(u * 40) % 7 === 0 && r > 3) { discF(x, y, Math.min(2.5, r * 0.3), 74); P(x, y, 75); } }
    // a pale porcelain claw at the very end (if it is still attached, or flying with the severed part)
    const n2 = pts.length;
    if (n2 > 3 && (cut >= 1 || sev)) { const [ax, ay, ar] = pts[n2 - 4], [bx2, by2, br] = pts[n2 - 1], a = Math.atan2(by2 - ay, bx2 - ax), L2 = br * 3.2 + 3, w = br * 1.1 + 1;
      z5Tri(bx2 - Math.sin(a) * w - Math.cos(a) * 2, by2 + Math.cos(a) * w - Math.sin(a) * 2, bx2 + Math.sin(a) * w - Math.cos(a) * 2, by2 - Math.cos(a) * w - Math.sin(a) * 2, bx2 + Math.cos(a) * L2, by2 + Math.sin(a) * L2, 67);
      z5Tri(bx2 - Math.sin(a) * w * 0.6, by2 + Math.cos(a) * w * 0.6, bx2 + Math.sin(a) * w * 0.3, by2 - Math.cos(a) * w * 0.3, bx2 + Math.cos(a) * L2 * 0.85, by2 + Math.sin(a) * L2 * 0.85, 65);
      lineP(bx2 - Math.sin(a) * w * 0.5, by2 + Math.cos(a) * w * 0.5, bx2 + Math.cos(a) * L2 * 0.8, by2 + Math.sin(a) * L2 * 0.8, 64); }
    // the raw end where it was cut
    if (cut < 1) { const i = fl(cut * n); if (pts[i]) { const [x, y, r] = pts[Math.min(i, pts.length - 1)]; discF(x, y, r * 0.9, 74); discF(x, y, r * 0.5, 75); } }
  }
  // a configurable beam: colAt(f, u) gives the colour at fraction f of the half-width (core 0 → edge 1 → fringe 1.5) and u along it
  function z5Beam(x0, y0, x1, y1, w, colAt, t, seed) {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, L = Math.sqrt(L2) || 1;
    const bx0 = Math.max(0, fl(Math.min(x0, x1) - w * 2)), bx1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + w * 2));
    const by0 = Math.max(0, fl(Math.min(y0, y1) - w * 2)), by1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + w * 2));
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, u = clamp((px * dx + py * dy) / L2, 0, 1), qx = px - u * dx, qy = py - u * dy, d = Math.sqrt(qx * qx + qy * qy);
      const wob = w * (0.85 + 0.15 * Math.sin(u * L * 0.25 - t * 40 + seed) + 0.08 * Math.sin(u * L * 0.7 + t * 23));
      if (d > wob * 1.5) continue;
      const f = d / wob;
      if (f > 1 && bay(x, y) > (1.5 - f) * 1.4) continue;
      BUF[y * W + x] = colAt(f, u * L, x, y);
    }
  }
  const voidCol = (t) => (f, s, x, y) => f < 0.42 ? (ih(x >> 1, (y >> 1) + fl(t * 30), 5021) < 0.02 ? 75 : 76) : f < 0.6 ? 77 : f < 0.8 ? 71 : f < 1 ? 74 : 73;
  const prismCol = (t) => (f, s) => f < 0.38 ? 22 : f < 0.6 ? 60 : PRISM[((fl(s / 5 - t * 40) % 7) + 7) % 7];
  // the picture is unwritten: columns eaten from the frame edges inward (from the top or the bottom), sparing a circle
  function z5Unwrite(prog, t, px, py, pr) {
    if (prog <= 0) return;
    const f = fl(t * 20), h = H - 2 * LB;
    for (let x = 0; x < W; x++) {
      const col = fl(x / 5), edge = Math.min(x, W - 1 - x) / (W / 2), up = ih(col, 2, 5031) < 0.5;
      const lim = (prog * 1.6 - edge * 0.9 - ih(col, 1, 5031) * 0.45) * h;
      if (lim <= 0) continue;
      for (let k = 0; k < Math.min(h, lim); k++) {
        const y = up ? LB + k : H - LB - 1 - k, i = y * W + x;
        if (pr) { const d = Math.hypot(x - px, y - py); if (d < pr) continue; if (d < pr + 2) { BUF[i] = PRISM[(fl(Math.atan2(y - py, x - px) * 4 + t * 8) % 7 + 7) % 7]; continue; } }
        BUF[i] = k > lim - 3 && ih(x, y + f, 732) < 0.6 ? 74 : ih(x >> 2, (y >> 2) + f, 733) < 0.03 ? 75 : 76;
      }
    }
  }
  // tear rows of the frame sideways between y0 and y1
  function z5Tear(y0, y1, amp, prob, t) {
    const f = fl(t * 24);
    for (let y = Math.max(LB, fl(y0)); y < Math.min(H - LB, y1); y++) {
      if (ih(y >> 2, f, 5041) > prob) continue;
      const sh = Math.round((ih(y >> 2, f, 5042) - 0.5) * 2 * amp); if (!sh) continue;
      TMP.set(BUF.subarray(y * W, y * W + W), 0);
      for (let x = 0; x < W; x++) BUF[y * W + x] = TMP[clamp(x - sh, 0, W - 1)];
    }
  }
  // the sky tear (the part-one rift if it's there, else a plain one)
  function z5Rift(cx, y0, y1, open, t, scale) {
    if (open <= 0) return;
    if (typeof skyRift === 'function') { skyRift(cx, y0, y1, open, t, scale); return; }
    for (let y = fl(y0); y <= y1; y++) { const u = (y - y0) / (y1 - y0), w = open * (1 - Math.abs(u - 0.5) * 2) * 60 + 1, x = cx + (vn(y, 0, 7, 91) - 0.5) * 30; for (let q = -w - 2; q <= w + 2; q++) P(x + q, y, Math.abs(q) <= w ? 76 : 64); }
  }
  // dawn over the cloud sea, bold: sky, sun, two banks of cloud; hz the horizon, ox a sideways drift
  function z5Dawn(t, hz, ox, sunX, sunY) {
    gradient(LB, hz, SKY_BOLD);
    glow(sunX, sunY, 150, T_WARM, 0.6); discF(sunX, sunY, 22, 15); discF(sunX, sunY, 18, 16); discF(sunX - 4, sunY - 4, 9, 22);
    cloudBank(hz + 8, 22, 80, 5051, ox * 0.5, CLOUD_SUN, false);
    cloudBank(hz + 44, 30, 60, 5052, ox, CLOUD_NEAR, false);
  }
  // the grey nothing: a faint light far above, slanting shafts, ash drifting up past a falling body
  function z5Grey(t, rise, dark) {
    gradient(LB, H - LB, dark ? [93, 92, 92, 0, 0] : [94, 93, 92, 92, 0]);
    for (let k = 0; k < 4; k++) {
      const x0 = 30 + k * 120 + Math.sin(t * 0.2 + k) * 20;
      for (let y = LB; y < H - LB; y++) for (let q = -14; q <= 14; q++) { const x = fl(x0 + (y - LB) * 0.42 + q); if (bay(x, y) < 0.3 * (1 - Math.abs(q) / 14) * (1 - (y - LB) / 230)) P(x, y, dark ? 93 : 94); }
    }
    for (let k = 0; k < 80; k++) { const u = frac(ih(k, 1, 5061) + t * rise * (0.4 + ih(k, 2, 5061))), x = ih(k, 3, 5061) * W + Math.sin(t * 0.5 + k) * 6, y = H - LB - u * (H - 2 * LB); P(x, y, ih(k, 4, 5061) < 0.3 ? 95 : 94); if (rise > 0.15 && k % 2) P(x, y + 1, 93); }
  }
  // the coral spark in the chest: a heartbeat that comes back
  function z5Spark(x, y, S, t) {
    if (t < 63.5) return;
    const flick = [[63.5, 63.6], [63.72, 63.8], [63.9, 64.0]];
    let on = t >= 64.1; for (const [a, b] of flick) if (t >= a && t < b) on = true;
    if (!on) return;
    let beat = 0; for (const b of [64.8, 65.25, 65.62, 65.9]) { const g = t - b; if (g > 0) beat = Math.max(beat, Math.exp(-g * 6) * (0.6 + (b - 64.8))); }
    const r = S * (0.35 + beat * 0.6) + 0.6;
    glow(x, y, S * (3 + beat * 6), T_WARM, 0.25 + beat * 0.4);
    discF(x, y, r * 1.6, 36); discF(x, y, r, 35); discF(x, y, r * 0.5, beat > 0.4 ? 22 : 37);
  }
  // cam(), but the focus is nudged so the view never reaches past the picture (cam would smear the edge rows into it)
  function z5Cam(z, r, fx, fy, sx, sy) {
    if (sx === undefined) { sx = fx; sy = fy; }
    const c = Math.cos(r) / z, s = Math.sin(r) / z;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [X, Y] of [[0, LB], [W, LB], [0, H - LB], [W, H - LB]]) { const dx = X - sx, dy = Y - sy, wx = dx * c + dy * s, wy = -dx * s + dy * c; x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); y0 = Math.min(y0, wy); y1 = Math.max(y1, wy); }
    fx = x1 - x0 >= W ? W / 2 - (x0 + x1) / 2 : clamp(fx, -x0, W - x1);
    fy = y1 - y0 >= H - 2 * LB ? H / 2 - (y0 + y1) / 2 : clamp(fy, LB - y0, H - LB - y1);
    cam(z, r, fx, fy, sx, sy);
  }
  // world → screen through cam(z, r, fx, fy, sx, sy)
  function z5Pt(z, r, fx, fy, sx, sy, x, y) { const wx = x - fx, wy = y - fy, c = Math.cos(r), s = Math.sin(r); return [sx + z * (c * wx - s * wy), sy + z * (s * wx + c * wy)]; }
  // a broken piece of the porcelain mask with one socket in it (eye 0..1 opens it); s ≈ size in mask units
  const MSP = []; for (let k = 0; k < 11; k++) { const a = k / 11 * TAU; MSP.push([Math.cos(a) * (9 + ih(k, 1, 5071) * 7) * (k > 6 ? 1.3 : 1), Math.sin(a) * (7 + ih(k, 2, 5071) * 6)]); }
  function z5MaskShard(cx, cy, s, ang, eye, look, t) {
    const R = 22 * s, ca = Math.cos(ang), sa = Math.sin(ang);
    for (let y = Math.max(0, fl(cy - R)); y <= Math.min(H - 1, cy + R); y++) for (let x = Math.max(0, fl(cx - R)); x <= Math.min(W - 1, cx + R); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, lx = (dx * ca + dy * sa) / s, ly = (-dx * sa + dy * ca) / s;
      let inside = false, emin = 1e9;
      for (let i = 0, j = MSP.length - 1; i < MSP.length; j = i++) {
        const [xi, yi] = MSP[i], [xj, yj] = MSP[j];
        if ((yi > ly) !== (yj > ly) && lx < (xj - xi) * (ly - yi) / (yj - yi) + xi) inside = !inside;
        const ex = xj - xi, ey = yj - yi, q = clamp(((lx - xi) * ex + (ly - yi) * ey) / (ex * ex + ey * ey), 0, 1); emin = Math.min(emin, Math.hypot(lx - xi - q * ex, ly - yi - q * ey));
      }
      if (!inside) continue;
      const lit = -lx * 0.05 - ly * 0.07;
      let c = emin < 1.1 / s + 0.5 ? (lx + ly < 0 ? 64 : 68) : BONE[clamp(fl(4.3 + lit * 2.2), 2, 5)];
      // the socket and its slit
      const ex = lx - 1, ey = ly + 1, rot = -0.38, rx = ex * Math.cos(rot) + ey * Math.sin(rot), ry = -ex * Math.sin(rot) + ey * Math.cos(rot), inn = rx * rx / 21 + ry * ry / 7.3;
      if (inn < 1) { c = inn > 0.7 ? 77 : 76; const px = ex - look * 1.6, py = ey; if (eye > 0.05 && Math.abs(px) < 1.1 * eye && Math.abs(py) < 2.4) c = Math.abs(px) < 0.4 && Math.abs(py) < 1.2 ? 22 : 75; }
      else if (inn < 1.35) c = 67;
      if (ey > 2 && ey < 11 && Math.abs(ex + 1.5 - Math.sin(ey * 0.5) * 0.8) < 0.5) c = 77;              // the old black tear
      if (eye > 0.6) for (let j = 0; j < 3; j++) { const a = PI + (j - 1) * 0.6, al = ex * Math.cos(a) + ey * Math.sin(a), ac = -ex * Math.sin(a) + ey * Math.cos(a) + Math.sin(al + j) * 0.8; if (al > 4.6 && al < 4.6 + 6 * (eye - 0.6) * 2.5 && Math.abs(ac) < 0.35) c = 72; }
      BUF[y * W + x] = c;
    }
  }

  /* ================================================================ 1 — all hope lost (0:57–1:06) */
  // A: the open hand lets the grey hero fall; far above, the colossus speaks, closes its eyes and turns away into the haze
  function lostA(lt, t) {
    const fall = 110 * Math.pow(lt / 4.2, 1.25), drift = fall * 0.4;
    z5Grey(t, 0.05, false);
    Z5C.set(BUF);
    const away = sstep(60.0, 61.2, t), talk = t > 58.5 && t < 61.2 ? Math.abs(Math.sin(t * 9)) * 0.35 : 0;
    unmaker(318 + away * 14, 70 - drift, 1.1, t, { eyes: lerp(2, 0, sstep(59.9, 60.8, t)), look: [-0.9 * away, 0.5 - away * 0.6], grin: lerp(1, 0.25, sstep(59.5, 60.8, t)) - talk, crack: 1, eye4: lerp(1, 0.4, away), halo: 1 - away * 0.4, heart: 1, glow: 0,
      arms: [[-50, 30, -112, 50, eoc(lt / 0.8)], [52, 30, 92, 70, 0.2]] });
    // the haze swallows it as it turns away: its greys are lifted, in clumps, toward the grey of the void
    const fade = 0.7 + away * 1.4;
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (BUF[i] === Z5C[i]) continue;
      let L = GLEV.indexOf(GREYM[BUF[i]]); const st = fl(fade + (vn(x, y + t * 6, 7, 5008) - 0.5) * 1.1);
      for (let k = 0; k < st; k++) L += L < 2 ? 1 : L > 2 ? -1 : 0;
      BUF[i] = GRAW[L];
    }
    const hx = 196 + lt * 4, hy = 128 + fall - drift;
    z5Shards(hx, hy, 46, 1.4, t + 3, 0, 0, 0);
    actor(HERO({ form: 'grey', eyes: 'closed', legs: [0, 1, 0, 2], outline: 95 }), hx, hy, 1.4, 0.3 + lt * 0.32, false);
    z5Cam(1.02 + lt * 0.012, 0.012 * Math.sin(t * 0.4), 240, 135);
    mapFx(GREYM, 1);
  }
  // B: closer, the hero tumbling slowly through nothing, the pieces of the sword turning with it
  function lostB(lt, t) {
    z5Grey(t, 0.11, true);
    const hx = 238 + Math.sin(lt * 0.5) * 6, hy = 132 + lt * 3, ang = 0.9 + lt * 0.2;
    z5Shards(hx, hy, 150, 3.0, t, 0, 0, 0);
    actor(HERO({ form: 'grey', eyes: 'closed', legs: [1, 2, 0, 1], outline: 95 }), hx, hy, 3.2, ang, false);
    z5Cam(1 + lt * 0.025, 0.02 * Math.sin(t * 0.3), hx, hy, 240, 135);
    mapFx(GREYM, 1);
  }
  // C: the face, eyes shut; then, in the chest, the only colour in the world
  function lostC(lt, t) {
    z5Grey(t, 0.07, true);
    const S = 7.2 + lt * 0.3, hx = 246 - lt * 2, hy = 150, ang = 0.2 - lt * 0.05;
    actor(HERO({ form: 'grey', eyes: 'closed', outline: 93 }), hx, hy, S, ang, false);
    // one big shard drifts across the foreground and catches the light
    const u = lin(0.2, 2.7, lt), sx = lerp(520, -60, u), sy = lerp(70, 110, u), rot = 2.2 + lt * 0.5, lit = Math.pow(Math.max(0, Math.cos(rot * 1.3 + 0.8)), 6);
    z5Shard(sx, sy, 34, 5, rot, lit, true);
    mapFx(GREYM, 1);
    z5Spark(hx - Math.sin(ang) * 3 * S, hy + Math.cos(ang) * 3 * S, S, t);
  }
  shot(57.0, 66.0, (lt, t) => {
    if (t < 60.4) lostA(lt, t);
    else if (t < 61.0) z5Mix(lin(60.4, 61.0, t), () => lostA(lt, t), () => lostB(t - 60.4, t));
    else if (t < 63.2) lostB(t - 60.4, t);
    else if (t < 63.45) z5Mix(lin(63.2, 63.45, t), () => lostB(t - 60.4, t), () => lostC(t - 63.2, t));
    else lostC(t - 63.2, t);
  });
  CAPS.push([58.5, 61.2, 's', 'UNMAKER', 'STORIES END. YOURS JUST DID.'], [61.5, 63.4, 'n', '', 'AND FOR A MOMENT, THERE WAS NOTHING.'], [64.8, 65.9, 's', 'HERO', '...NOT... YET.']);

  /* ================================================================ 2 — the eye opens (1:06–1:08) */
  shot(66.0, 68.0, (lt, t) => {
    // one sprite pixel is B screen pixels; the left eye (cells -9..-8, -4..-2) sits at (EX, EY)
    const B = 15 + lt * 2.2, EX = 206, EY = 142;
    const X = (lx) => EX + (lx + 8) * B, Y = (ly) => EY + (ly + 3) * B;
    rectF(0, 0, W, H, 92);
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 5101) + t * 0.08), x = ih(k, 2, 5101) * W; P(x, H - LB - u * 220, 93); }
    rectF(X(-13) - B, Y(-8) - B, B * 28, B * 18, 93);        // the outline
    rectF(X(-13), Y(-8), B * 26, B * 16, 94);                // the face
    for (let y = fl(Y(5)); y < H; y++) for (let x = fl(X(-13)); x < X(13); x++) if (bay(x, y) < 0.5) P(x, y, 93);
    const open = eob(lin(0.5, 0.78, lt)), shake = lt > 0.25 && lt < 0.5 ? Math.round((ih(fl(t * 30), 1, 5102) - 0.5) * 4) : 0;
    // the warm light from the chest below, beating
    glow(X(0), Y(3), 260, T_WARM, 0.18 + 0.12 * Math.exp(-((lt % 0.45) * 8)) + open * 0.2);
    if (open <= 0.02) rectF(X(-9) + shake, Y(-2), 2 * B, B, 0);
    else {
      const top = Y(-2) - 2 * B * open, bot = Y(-1);
      glow(X(-8), Y(-2.5), 90 + open * 120, T_GOLD, 0.5 + open * 0.3);
      rectF(X(-10), Math.min(top - B * open, Y(-2)), 4 * B, bot - top + B * open * 2, 59);
      rectF(X(-9.5), top - B * 0.5 * open, 3 * B, bot - top + B * open, 60);
      rectF(X(-9), top, 2 * B, bot - top, 22);
    }
    const g = lt - 0.78;
    if (g > 0) {
      const cx = X(-8), cy = Y(-2.5);
      z5Sunburst(cx, cy, 18, t * 0.4, 10, 60 + eoc(g / 0.5) * 360, 0.1 + g * 0.05, [60, 59, 22]);
      burst(cx, cy, g / 0.4, 260, 20, 0.3, [22, 60], 3);
      shockRing(cx, cy, 10 + g * 380, 10 + g * 380, 4, [22, 60, 59], 1 - g / 0.7);
      glow(cx, cy, 60 + g * 200, T_WH, 0.8);
      shk(5 * Math.exp(-g * 4) + g * 2);
    }
    z5Cam(1 + lt * 0.04, 0, 240, 135);
    flashWhite(sstep(1.55, 1.97, lt));
  });

  /* ================================================================ 3 — the elements come home (1:08–1:12) */
  const CRK = [[-30, 38, -0.4], [26, 46, 0.5], [-10, 64, 2.6], [36, 70, -2.6]];   // where the light splits the body (local), and which way
  shot(68.0, 69.6, (lt, t) => {
    gradient(LB, H - LB, [93, 93, 92, 92, 0]);
    cloudBank(236, 26, 70, 5111, t * 4, GREYS, true);
    const go = lt - 1.0, recoil = eoc(clamp(go / 0.3, 0, 1)), BX = 300, BY = 80 - recoil * 10, s = 2.05;
    flashWhite(lt < 0.1 ? 1 - lt / 0.1 : 0);
    unmaker(BX, BY, s, t, { eyes: 2, crack: 1, eye4: 1, grin: lerp(1, 0.2, sstep(0.2, 0.9, lt)), look: [-0.7, 0.6], halo: 1, shake: lt * 3 + recoil * 4,
      arms: [[-50, 30, -84 + recoil * 20, 30 - recoil * 30, 0.4 + recoil * 0.6], [52, 30, 86, 40 - recoil * 20, 0.6 + recoil * 0.4]] });
    for (let k = 0; k < 4; k++) {
      const g = lt - k * 0.22; if (g < 0) continue;
      const [lx, ly, a] = CRK[k], cx = BX + lx * s, cy = BY + ly * s, len = eoc(g / 0.25) * 58, col = ORB[k];
      glow(cx, cy, 50 + len, EL_T[k], 0.75);
      for (let j = 0; j < 5; j++) z5Ray(cx, cy, a + PI / 2 + (j - 2) * 0.32, 30 + len * 2.5 + (go > 0 ? go * 300 : 0), 3 + (j === 2 ? 2 : 0), 22, col[2], 1);
      for (let j = 0; j < 5; j++) z5Ray(cx, cy, a - PI / 2 + (j - 2) * 0.32, 20 + len * 1.5, 3, 22, col[2], 1);
      bolt(cx - Math.cos(a) * len, cy - Math.sin(a) * len, cx + Math.cos(a) * len, cy + Math.sin(a) * len, k + 7, 4, 22, col[2], 0.3);
      discF(cx, cy, 4 + len * 0.08, 22);
      if (g < 0.1) shk(3);
      // and then the orb tears free, out toward the hero (off-frame, lower left)
      const og = go - k * 0.06;
      if (og > 0) {
        const u = eic(clamp(og / 0.5, 0, 1)), ox = lerp(cx, -60, u), oy = lerp(cy, 300, u) - Math.sin(u * PI) * 40;
        for (let q = 1; q < 10; q++) { const u2 = eic(clamp((og - q * 0.025) / 0.5, 0, 1)); discF(lerp(cx, -60, u2), lerp(cy, 300, u2) - Math.sin(u2 * PI) * 40, 6 - q * 0.5, q < 3 ? 22 : col[q < 6 ? 2 : 1]); }
        orbAt(ox, oy, k, 7, t);
        if (og < 0.25) { burst(cx, cy, og / 0.25, 90, 12, k, [22, col[2]], 3); debris(cx, cy, og, 14, 140, 1.2, [77, 73, 74], 5112 + k, 300); }
      }
    }
    if (go > 0) shk(6 * Math.exp(-go * 5));
    z5Cam(1.04 + lt * 0.05 + (go > 0 ? 0.08 * Math.exp(-go * 6) : 0), -0.02, 280, 130);
  });
  FLASH_CUTS.push(69.6);
  // the hero takes them back; the broken blade flies together into light
  const ORB_IN = [0.2, 0.45, 0.7, 0.95];
  shot(69.6, 72.0, (lt, t) => {
    const build = sstep(1.6, 2.4, lt), HX = 240, HY = 150, S = 3.4;
    gradient(LB, H - LB, [92, 93, 92, 0]);
    radialLines(HX, HY, 30 + fl(build * 40), 60 - build * 30, 93, t, 5121);
    const nIn = ORB_IN.filter((a) => lt >= a).length, restored = lt >= ORB_IN[3];
    if (nIn) radialLines(HX, HY, nIn * 8, 70, ORB[(fl(t * 12)) % nIn][2], t, 5122);
    // the four orbs streak in from the upper right
    for (let k = 0; k < 4; k++) {
      const g = lt - ORB_IN[k], sx = W + 30, sy = 40 + k * 40;
      if (g < -0.35) continue;
      if (g < 0) { const u = eic(1 + g / 0.35); for (let q = 0; q < 12; q++) { const u2 = Math.max(0, u - q * 0.03); discF(lerp(sx, HX, u2), lerp(sy, HY, u2), 6 - q * 0.4, q < 2 ? 22 : ORB[k][q < 6 ? 2 : 1]); } orbAt(lerp(sx, HX, u), lerp(sy, HY, u), k, 7, t); }
      else if (g < 0.35) { glow(HX, HY, 80, EL_T[k], 0.8 * (1 - g / 0.35)); shockRing(HX, HY, 8 + g * 300, 8 + g * 300, 4, [22, ORB[k][2], ORB[k][1]], 1 - g / 0.35); burst(HX, HY, g / 0.3, 120, 14, k, [22, ORB[k][2]], 3); if (g < 0.1) shk(4); }
    }
    const white = ORB_IN.some((a) => lt >= a && lt < a + 0.067);
    const o = HERO({ form: restored ? undefined : 'grey', eyes: 'glow', legs: [0, 1, 0, 1], sq: build * Math.sin(t * 40) * 0.06 });
    if (lt > 1.75) { o.sword = -0.9; o.swordCols = lt < 1.85 ? [22] : z5Sw(t); }
    const vib = build * 2, jx = Math.round((ih(fl(t * 30), 1, 5123) - 0.5) * vib * 2);
    if (nIn) z5Orbs(HX, HY, 34, t, 4, 0.4, false, ORB_IN.map((a) => lt > a + 0.1));
    const a = actor(o, HX + jx, HY, S, -0.05, false, { white });
    if (nIn) aura(t, restored ? ZEN_AURA : AURA_GOLD, 6 + build * 14, { sparks: 10 + fl(build * 30) });
    if (nIn) z5Orbs(HX, HY, 34, t, 4, 0.4, true, ORB_IN.map((a) => lt > a + 0.1));
    // the shards: scattered, then pulled in to the hand
    const hand = a.hand, tipx = hand[0] + Math.cos(-0.9) * 29 * S * 0.5, tipy = hand[1] + Math.sin(-0.9) * 29 * S * 0.5;
    if (lt < 1.8) z5Shards(HX, HY, 220, 2.4, t, lin(1.15, 1.75, lt), tipx, tipy);
    const fg = lt - 1.75;
    if (fg > 0 && fg < 0.4) { glow(tipx, tipy, 70, T_WH, 0.9 * (1 - fg / 0.4)); sparkle(tipx, tipy, 18 * (1 - fg / 0.4), 22, 60); shockRing(tipx, tipy, 4 + fg * 200, 4 + fg * 200, 3, [22, 60, 83], 1 - fg / 0.4); shk(4); }
    shk(build * 4);
    z5Cam(1 + 0.32 * eic(build), build * 0.05 * Math.sin(t * 30), HX, HY - 10, 240, 135);
    zoomBlur(240, 130, 0.1 * build);
    flashWhite(lt > 2.335 ? 1 : 0);
  });

  /* ================================================================ 4 — FABLE... ZENITH! (1:12–1:16) */
  shot(72.0, 73.4, (lt, t) => {
    const HX = 240, HY = 190, S = 3.3, R = 24 + eoc(lt / 1.3) * 250;
    z5Dawn(t, 206, t * 10, 372, 204);
    z5GodRays(HX, HY - 10, 9, t * 0.8, T_WH, 0.5, 400);
    z5Sunburst(HX, HY - 14, 16, t * 0.5, 24, 330, 0.1);
    glow(HX, HY - 14, 150, T_GOLD, 0.65);
    z5Wave(HX, HY - 20, R, 214, 2.5, t);
    const sq = lt < 0.08 ? 0.35 : lt < 0.25 ? lerp(-0.25, 0, eoc((lt - 0.08) / 0.17)) : 0;
    z5Zenith(HX, HY, S, t, { sw: -1.3, mouth: lt < 1.0 ? 2 : 0, spread: eob(lin(0.05, 0.6, lt)), orbR: 48, sq, auraR: 14, sparks: 30, legs: [1, 0, 1, 0] });
    shockRing(HX, HY, 10 + lt * 520, 10 + lt * 520, 5, [22, 60, 59], 1 - lt / 0.8);
    flashWhite(lt < 0.067 ? 1 : 0);
    shk(6 * Math.exp(-lt * 3));
    z5Cam(1.3 - 0.3 * eoc(lt / 0.5), 0, HX, HY - 30, 240, 150);
  });
  CAPS.push([72.0, 73.3, 'x', '', 'FABLE...', 52], [72.45, 73.3, 'x', '', 'ZENITH!', 104]);
  // the wave of colour rolls out over the whole sea of cloud
  shot(73.4, 76.0, (lt, t) => {
    const HX = 240, HY = 118, R = 60 + 640 * sstep(0, 2.3, lt);
    z5Dawn(t, 176, t * 14, 330, 182);
    z5GodRays(330, 182, 7, t * 0.3, T_WARM, 0.55, 420);
    z5Sunburst(HX, HY, 14, t * 0.3, 18, 150, 0.07);
    z5Wave(HX, HY, R, 176, 3.2, t);
    for (let k = 0; k < 40; k++) { const a = ih(k, 1, 5131) * TAU, rr = R + (ih(k, 2, 5131) - 0.5) * 16, x = HX + Math.cos(a) * rr, y = HY + Math.sin(a) * rr * (Math.sin(a) > 0 ? 0.32 : 1); sparkle(x, y, 1 + ih(k, 3, 5131) * 2, 22, PRISM[k % 7]); }
    z5Zenith(HX, HY + Math.sin(t * 2) * 2, 2.1, t, { sw: -1.3, spread: 1, orbR: 30, auraR: 7, sparks: 14 });
    z5Cam(1.16 - 0.14 * eio(lt / 2.6), 0.03 * Math.sin(lt * 1.2), HX, HY + 10, 240, 132);
  });

  /* ================================================================ 5 — the hero shot (1:16–1:20) */
  shot(76.0, 80.0, (lt, t) => {
    const HX = 240, HY = 150, S = 3.4, sunX = 268, sunY = 112, orbit = eio(lt / 4);
    gradient(LB, H - LB, [2, 3, 4, 5, 6, 7, 8, 13, 14, 15]);
    z5GodRays(sunX, sunY, 8, orbit * 1.4 + t * 0.1, T_WARM, 0.7, 420);
    glow(sunX, sunY, 130, T_WARM, 0.8); discF(sunX, sunY, 18, 16); discF(sunX, sunY, 13, 22);
    // far clouds drifting one way, near clouds the other (the camera circles)
    for (let k = 0; k < 7; k++) cloudPuff(frac(ih(k, 1, 5141) - lt * 0.05) * 700 - 110, 190 + ih(k, 2, 5141) * 40, 18 + ih(k, 3, 5141) * 14, CLOUD_SUN, 5142 + k);
    z5Sunburst(HX, HY - 10, 18, -t * 0.25, 30, 170, 0.06);
    const sw = lerp(-0.7, -1.45, eob(lin(0.1, 0.9, lt))), spread = 1 + 0.15 * Math.exp(-lt * 1.3) * Math.sin(lt * 7);
    const a = z5Zenith(HX, HY + Math.sin(t * 1.8) * 2, S, t, { sw, spread, orbR: 52, auraR: 9, sparks: 20, tilt: 0.3, legs: [1, 0, 1, 0], flap: 0.04 });
    // the glint runs up the blade
    const gl = lin(2.0, 2.4, lt);
    if (gl > 0 && gl < 1) sparkle(lerp(a.hand[0], a.tip[0], gl), lerp(a.hand[1], a.tip[1], gl), 4, 22, 60);
    if (lt > 2.4 && lt < 2.9) { const k = 1 - (lt - 2.4) / 0.5; sparkle(a.tip[0], a.tip[1], 14 * k, 22, 60); glow(a.tip[0], a.tip[1], 40 * k, T_WH, 0.6 * k); }
    for (let k = 0; k < 6; k++) cloudPuff(frac(ih(k, 4, 5141) + lt * 0.22) * 900 - 250, 236 + ih(k, 5, 5141) * 26, 26 + ih(k, 6, 5141) * 16, CLOUD_NEAR, 5150 + k);
    z5Cam(0.98 + 0.12 * orbit, lerp(-0.08, 0.06, orbit), HX, HY - 4, 240, 140);
  });

  /* ================================================================ 6 — it recoils (1:20–1:24) */
  shot(80.0, 81.6, (lt, t) => {
    const rc = eob(lin(0.15, 0.75, lt)), bnd = 170 + rc * 40;
    // the sky splits: dawn on the hero's side, the void on its side, a prism seam between them
    z5Dawn(t, 200, t * 10, 60, 190);
    for (let y = LB; y < H - LB; y++) {
      const sx = bnd + Math.sin(y * 0.06 + t * 3) * 6 + (y - 135) * 0.25;
      for (let x = 0; x < W; x++) {
        if (x < sx) continue;
        const i = y * W + x;
        if (x < sx + 2) { BUF[i] = 22; continue; }
        if (x < sx + 5) { BUF[i] = PRISM[(fl(y / 3 + t * 10)) % 7]; continue; }
        BUF[i] = y < 200 ? VOIDSKY[clamp(fl((y - LB) / 36 + bay(x, y) * 0.9), 0, 4)] : T_NIGHT[5][GREYM[BUF[i]]];
      }
    }
    stars(t, 200, 40, 5161);
    const BX = 344 + rc * 26, BY = 98 - rc * 12, s = 1.9;
    unmaker(BX, BY, s, t, { eyes: 2, crack: 1, eye4: 1, grin: lerp(0.6, 0, rc), look: [-1, 0.4], halo: 1, shake: 1 + rc * 3,
      arms: [[52, 30, lerp(84, -8, rc), lerp(40, 4, rc), 1], [-50, 30, lerp(-80, -60, rc), lerp(30, 60, rc), 0.3]] });
    z5GodRays(120, 152, 6, t * 0.5, T_WH, 0.35 + rc * 0.2, 260);
    z5Zenith(120, 152, 1.9, t, { sw: -0.35, spread: 1, orbR: 26, rays: 220, raysA: 0.5, auraR: 6 });
    z5Cam(1.02 + lt * 0.03, 0, 240, 135);
  });
  shot(81.6, 84.0, (lt, t) => {
    const CX = 240, CY = 148, s = 4.4, f = fl(t * 30);
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 90, 5171);
    glow(CX, CY - 20, 200, T_MAG, 0.25 + lt * 0.08);
    const brk = lt > 1.4 ? 0.05 * eic(lin(1.4, 2.4, lt)) + (lt > 2.1 ? 0.006 * (f & 1) : 0) : 0;
    unmaker(CX, CY, s, t, { eyes: 2, crack: 1, eye4: 0.7 + 0.3 * ih(f, 1, 5172), grin: lerp(0.3, 0, lin(0, 1, lt)), look: [Math.sin(t * 13) * 0.8, Math.cos(t * 9) * 0.5], halo: 1, body: false,
      shake: 1 + lt * 2.6, broken: brk, glow: 0.5 });
    // light leaking out through the cracks
    glow(CX + 8 * s, CY - 10 * s, 60, T_WH, 0.25 + lt * 0.1);
    z5Tear(CY - 30 * s, CY + 30 * s, 6 + lt * 8, 0.1 + lt * 0.12, t);
    if (lt > 2.1 && lt < 2.167) mapFx(INV, 1);
    shk(1 + lt * 1.4);
    z5Cam(1 + lt * 0.06, 0.01 * Math.sin(t * 17), CX, CY - 10, 240, 135);
  });

  /* ================================================================ 7 — the mask breaks; the page is unwritten (1:24–1:28) */
  shot(84.0, 85.7, (lt, t) => {
    const CX = 240, CY = 126, s = 3.3, f = fl(t * 30);
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 90, 5181);
    radialLines(CX, CY, 50, 70, 72, t, 5182);
    const brk = Math.min(1.25, eoc(lin(0, 0.9, lt)) * 1.25);
    unmaker(CX, CY, s, t, { eyes: 2, crack: 1, eye4: 1, halo: 1, broken: brk, heart: 1, arms: [[-50, 30, -96, -6, 1], [50, 30, 96, -6, 1]] });
    debris(CX, CY - 20, lt, 50, 170, 1.3, [64, 65, 66, 67], 5183, 220);
    shockRing(CX, CY, 10 + lt * 420, 10 + lt * 420, 4, [75, 73, 71], 1 - lt / 0.9);
    if (lt < 0.034) flashWhite(1);
    else if (lt < 0.134) impactFrame(CX, CY, 0);
    shk(8 * Math.exp(-lt * 3));
    z5Cam(1.16 - 0.16 * eoc(lt / 0.5), 0.05 * Math.exp(-lt * 3), CX, CY, 240, 135);
  });
  FLASH_CUTS.push(85.7);
  shot(85.7, 88.0, (lt, t) => {
    const BX = 318, BY = 92, s = 1.55, HX = 108, HY = 166;
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 70, 5191);
    cloudBank(236, 20, 60, 5192, t * 6, [77, 78, 79, 62], false);
    unmaker(BX, BY, s, t, { eyes: 2, broken: 1.25, halo: 1, heart: 1, arms: [[-50, 30, -100, 10, 1], [50, 30, 100, 0, 1]] });
    shatterFx(BX, BY, 0.4 * sstep(1.3, 2.2, lt) + (lt > 1.0 && lt < 1.1 ? 0.25 : 0), t, 34);
    z5Unwrite(eio(lin(0.2, 2.3, lt)) * 0.75, t, HX, HY, 34);
    const creep = 34 * eio(lin(0.4, 2.3, lt));
    rectF(0, LB, W, creep, 0); rectF(0, H - LB - creep, W, creep, 0);
    for (let x = 0; x < W; x++) { if (ih(x >> 2, fl(t * 20), 5193) < 0.5) { P(x, LB + creep, 74); P(x, H - LB - creep - 1, 74); } }
    z5Zenith(HX, HY, 1.7, t, { sw: -0.5, spread: 1, orbR: 22, auraR: 6 });
    shk(1.5);
  });
  CAPS.push([84.5, 87.6, 's', 'UNMAKER', 'YOU CANNOT FIGHT THE END OF THE PAGE.']);

  /* ================================================================ 8 — the black hole (1:28–1:32) */
  const SPIRAL_CLOUDS = 34;
  function pulledClouds(cx, cy, t, R0, seed) {
    for (let k = 0; k < SPIRAL_CLOUDS; k++) {
      const u = frac(ih(k, 1, seed) + t * (0.12 + ih(k, 2, seed) * 0.1)), r = R0 * Math.pow(1 - u, 1.3) + 20, a = ih(k, 3, seed) * TAU + 2.4 / (r / R0 + 0.15) + t * 0.6;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.75, sz = 4 + r * 0.07;
      if (r < 30) continue;
      cloudPuff(x, y, sz, u > 0.7 ? [77, 79, 73, 74] : [17, 18, 20, 21], seed + k);
    }
  }
  shot(88.0, 90.2, (lt, t) => {
    const EX = 336, EY = 116;
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 120, 5201);
    cloudBank(230, 22, 60, 5202, t * 10, [17, 18, 19, 20], false);
    z5Swirl(EX, EY, 1.5 + lt * 0.3, 110);
    unmaker(EX, EY + 6, 2.6, t, { eyes: 2, broken: 1.3, halo: 1, heart: 1, arms: [[-50, 30, -100, 0, 1], [50, 30, 100, 0, 1]] });
    pulledClouds(EX, EY, t, 300, 5203);
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 5204) + t * 0.5), a = ih(k, 2, 5204) * TAU + u * 3, r = (1 - u) * 300 + 10; rectF(EX + Math.cos(a) * r, EY + Math.sin(a) * r * 0.75, 2, 2, PRISM[k % 7]); }
    radialLines(EX, EY, 30, 70, 74, t, 5205);
    const hx = 70 + eio(lt / 2.2) * 60, hy = 176 + Math.sin(t * 5) * 3;
    z5Zenith(hx, hy, 2.1, t, { ang: 0.28, sw: 0.1, spread: 0.9 + 0.15 * Math.sin(t * 22), wt: t * 3, orbR: 26, auraR: 7, rise: 0.3 });
    shk(1.5 + lt);
    z5Cam(1.02 + lt * 0.05, lt * 0.03, 240, 140);
  });
  shot(90.2, 92.0, (lt, t) => {
    const EX = 520, EY = 120, HX = 196 + lt * 8, HY = 148;
    gradient(LB, H - LB, [76, 77, 78, 79, 78]);
    spiralEye(EX, EY, 170, t, 1);
    z5Swirl(EX, EY, 1.1, 160);
    streaks(0, 60, t, 2600, 74, 70, 5211, [0, LB, W, H - 2 * LB]);
    streaks(0.08, 30, t, 2000, 20, 50, 5212, [0, LB, W, H - 2 * LB]);
    for (let k = 0; k < 7; k++) cloudPuff(frac(ih(k, 1, 5213) + t * 0.9) * 700 - 120, 40 + ih(k, 2, 5213) * 200, 8 + ih(k, 3, 5213) * 8, [17, 18, 20, 21], 5214 + k);
    // tendrils rise from the eye, feeling for the hero
    const tg = lin(1.0, 1.8, lt);
    if (tg > 0) for (let k = 0; k < 3; k++) z5Tendril(EX - 60, EY + (k - 1) * 70, 420, EY + (k - 1) * 90 + Math.sin(t * 3 + k) * 30, lerp(430, 320, eoc(tg)) - k * 20, HY + (k - 1) * 60, 9, t, k * 3);
    const jx = Math.round((ih(fl(t * 30), 1, 5215) - 0.5) * 3);
    z5Zenith(HX + jx, HY, 4.0, t, { ang: 0.32, sw: 0.25, spread: 0.85 + 0.2 * Math.sin(t * 26), wt: t * 4, mouth: 1, orbR: 50, auraR: 12, rise: 0.2, sq: 0.1 });
    shk(2.5);
    z5Cam(1.04 + lt * 0.03, 0.02 * Math.sin(t * 7), 240, 135);
  });

  /* ================================================================ 9 — the last fight: tendrils against the blade (1:32–1:36) */
  const HITS9 = [0.8, 1.6, 2.4, 3.2], HS = 0.07, TH9 = HITS9.map((h, k) => h - k * HS);   // shot time → track time
  const HK9 = K(
    { t: 0, x: 120, y: 150, a: 0, sw: -0.6, S: 2.6 },
    { t: 0.5, x: 136, y: 160, sw: 1.4, a: 0.2, e: 'o' },
    { t: TH9[0], x: 178, y: 138, sw: -2.0, a: -0.25, e: 'i' },
    { t: TH9[0] + 0.25, x: 184, y: 132, sw: -1.8, a: -0.1, e: 'o' },
    { t: TH9[1] - 0.2, x: 236, y: 96, sw: -2.4, a: -0.35, e: 'io' },
    { t: TH9[1], x: 266, y: 118, sw: 1.3, a: 0.35, e: 'i' },
    { t: TH9[1] + 0.25, x: 272, y: 124, sw: 1.1, a: 0.2, e: 'o' },
    { t: TH9[2] - 0.22, x: 292, y: 154, sw: 0.2, a: 0, e: 'io' },
    { t: TH9[2], x: 318, y: 150, sw: 0.2, a: -TAU, e: 'i' },
    { t: TH9[2] + 0.18, x: 322, y: 148, a: -TAU, e: 'o' },
    { t: TH9[3] - 0.22, x: 300, y: 146, sw: 0, a: -TAU, sq: 0.3, reach: 0, e: 'io' },
    { t: TH9[3], x: 384, y: 140, sw: 0, sq: -0.25, reach: 8, e: 'i' },
    { t: TH9[3] + 0.3, x: 398, y: 138, sq: 0, reach: 2, e: 'o' },
    { t: 4.0, x: 440, y: 104, S: 2.0, e: 'io' });
  // each tendril: root, the point it rears back to, where it strikes (the hero's blade meets it at the hit)
  const TN9 = [
    { root: [500, 10], back: [400, 30], hit: [262, 104] },
    { root: [520, 280], back: [430, 250], hit: [350, 152] },
    { root: [470, 10], back: [430, 20], hit: [404, 156] },
    { root: [640, 140], back: [600, 124], hit: [452, 140], big: 1 },
  ];
  shot(92.0, 96.0, (lt, t) => {
    const [tt, frz] = stopClock(lt, TH9, HS);
    FRZ = frz ? 2 : 0;
    const tw = frz ? T_NOW - (lt - tt) : t;                // world clock, also frozen during the hit-stop
    gradient(LB, H - LB, [76, 77, 78, 79, 80, 62]); stars(tw, H, 70, 5221);
    spiralEye(430, 74, 52, tw, 1);
    pulledClouds(430, 74, tw, 260, 5222);
    glow(40, 200, 200, T_WARM, 0.25);
    // more of them, writhing behind, waiting
    for (let k = 0; k < 3; k++) z5Tendril(430, 74, 360 - k * 30, 160 + k * 30 + Math.sin(tw * 2 + k) * 20, 300 - k * 50 + Math.sin(tw * 1.3 + k) * 30, 230 - k * 20, 7, tw, 20 + k * 5);
    TN9.forEach((d, k) => {
      const h = TH9[k], g = tt - h, w0 = d.big ? 26 : 15;
      if (tt < h - 0.75) return;
      const u = tt < h ? eic(clamp((tt - (h - 0.3)) / 0.3, 0, 1)) : 1, rear = eoc(clamp((tt - (h - 0.75)) / 0.45, 0, 1));
      const tip = tt < h ? [lerp(lerp(d.root[0], d.back[0], rear), d.hit[0], u), lerp(lerp(d.root[1], d.back[1], rear), d.hit[1], u)] : d.hit;
      const q = [(d.root[0] + tip[0]) / 2 + 40, (d.root[1] + tip[1]) / 2 + (k & 1 ? -40 : 40)];
      if (g < 0) z5Tendril(d.root[0], d.root[1], q[0], q[1], tip[0], tip[1], w0, tw, k * 3);
      else if (g < 1.2) {
        // cut: the stump recoils, the severed end flies off and comes apart
        const rc = eoc(clamp(g / 0.4, 0, 1)), sx = lerp(tip[0], d.back[0], rc * 0.6), sy = lerp(tip[1], d.back[1], rc * 0.6);
        if (d.big) { z5Tendril(d.root[0], d.root[1], q[0], q[1] - 10, sx, sy - 12 - g * 60, w0 * 0.6, tw, k * 3, 0.85, [-60, -120, g]); z5Tendril(d.root[0], d.root[1] + 6, q[0], q[1] + 10, sx, sy + 12 + g * 60, w0 * 0.6, tw, k * 3 + 1, 0.85, [-60, 80, g]); }
        else z5Tendril(d.root[0], d.root[1], q[0], q[1], sx, sy, w0, tw, k * 3, 0.82, [(k & 1 ? -1 : 1) * 120, -80, g]);
      }
    });
    const hero = z5Fight(HK9, tt, { S: 2.6, orbR: 28, auraR: 8, flap: 2 });
    HITS9.forEach((h, k) => { const g = lt - h; if (g >= 0 && g < 0.5) { hitFx(TN9[k].hit[0], TN9[k].hit[1], g, k === 3 ? 1.4 : 1, [22, PRISM[(k * 2) % 7]]); if (g >= 0.034 && g < 0.067) impactFrame(TN9[k].hit[0], TN9[k].hit[1], 0); } });
    // the camera: a new angle after each whip, a kick on every hit
    const seg = lt < 1.2 ? 0 : lt < 2.0 ? 1 : lt < 2.8 ? 2 : 3, Z = [1.12, 1.22, 1.1, 1.08][seg], R = [-0.05, 0.07, -0.08, 0.03][seg];
    let kick = 0; for (const h of HITS9) { const g = lt - h; if (g > 0) kick += 0.14 * Math.exp(-g * 9); }
    const z = (seg === 3 ? lerp(1.15, 1.0, eio(lin(3.3, 4.0, lt))) : Z) + kick;
    z5Cam(z, R + kick * 0.3, lerp(hero.x, 240, 0.35), lerp(hero.y, 135, 0.4), 240, 135);
  });
  WHIPS.push([93.2, 0], [94.0, PI], [94.8, 0.4]);

  /* ================================================================ 10 — the beam clash (1:36–1:40.5) */
  function clash10(lt) {
    if (lt < 1.5) return 248 + Math.sin(lt * 5) * 24 * (lt / 1.5);
    if (lt < 2.5) return lerp(248 + Math.sin(7.5) * 24, 150, eio((lt - 1.5) / 0.9));
    return lerp(150, 350, eio((lt - 2.5) / 2.0)) + Math.sin(lt * 14) * 3;
  }
  function clashWide(lt, t) {
    const cx = clash10(lt), cy = 132, surge = lt > 2.5 ? Math.exp(-(lt - 2.5) * 2) : 0;
    z5Dawn(t, 196, t * 30, 40, 200);
    for (let y = LB; y < H - LB; y++) {
      const sx = cx + Math.sin(y * 0.07 + t * 5) * 7;
      for (let x = Math.max(0, fl(sx)); x < W; x++) {
        const i = y * W + x;
        if (x < sx + 2) { BUF[i] = 22; continue; }
        if (x < sx + 5) { BUF[i] = PRISM[(fl(y / 3 + t * 12)) % 7]; continue; }
        BUF[i] = y < 196 ? VOIDSKY[clamp(fl((y - LB) / 34 + bay(x, y) * 0.9), 0, 4)] : T_NIGHT[5][GREYM[BUF[i]]];
      }
    }
    stars(t, 190, 30, 5231);
    const BX = 404, BY = 108, f = fl(t * 30);
    unmaker(BX, BY, 2.0, t, { eyes: 2, broken: 1.25, halo: 1, heart: 1, arms: [[-50, 30, -88, 40, 1], [50, 30, 70, 60, 0.5]], shake: 1 });
    const push = cx < 200 ? (200 - cx) * 0.25 : 0, hx = 84 - push + Math.round((ih(f, 2, 5232) - 0.5) * 3), hy = 136;
    z5Beam(BX - 6, BY - 4, cx, cy, 10, voidCol(t), t, 1);
    const hero = z5Zenith(hx, hy, 2.2, t, { sw: 0, sq: 0.15, spread: 1 + surge * 0.3, wt: t * 2, orbR: 26, auraR: 7 + surge * 12, mouth: lt > 2.5 ? 2 : 1, sparks: 16 });
    z5Beam(hero.tip[0] - 4, hero.tip[1], cx, cy, 10 + surge * 8 + (lt > 2.5 ? 3 : 0), prismCol(t), t, 2);
    if (surge > 0.2) shockRing(hx, hy, 10 + (1 - surge) * 260, 10 + (1 - surge) * 260, 4, [22, 60, 83], surge);
    const R = 18 + Math.sin(t * 30) * 2 + lt * 3;
    glow(cx, cy, R * 3, T_WH, 0.6);
    for (let y = fl(cy - R); y <= cy + R; y++) for (let x = fl(cx - R); x <= cx + R; x++) { const d = Math.hypot(x - cx, y - cy) / R + (vn(x, y, 3, fl(t * 20)) - 0.5) * 0.4; if (d < 1) P(x, y, d < 0.5 ? 22 : x < cx ? PRISM[fl(d * 9 + t * 20) % 7] : 74); }
    for (let k = 0; k < 4; k++) if (ih(k, fl(t * 15), 5233) < 0.7) { const a = ih(k, fl(t * 15) + 1, 5233) * TAU; bolt(cx, cy, cx + Math.cos(a) * 80, cy + Math.sin(a) * 60, fl(t * 15) + k * 5, 1, 22, k & 1 ? 74 : 83); }
    shk(2.5 + surge * 4);
    const zin = lt > 2.5 ? sstep(3.4, 3.8, lt) * (1 - sstep(4.3, 4.5, lt)) : sstep(0.6, 1.0, lt) * (1 - sstep(1.2, 1.5, lt)) * 0.5;
    z5Cam(1.04 + 0.55 * zin, 0.05 * zin * Math.sin(t * 20), cx, cy, 240, 135);
  }
  shot(96.0, 100.5, (lt, t) => {
    if (lt < 1.7 || lt >= 2.5) { clashWide(lt, t); return; }
    // the hero, close: the void beam pushing the blade back, the light on its face
    const u = lt - 1.7, HX = 170 - u * 12, HY = 150;
    gradient(LB, H - LB, [77, 78, 79, 80, 79]);
    streaks(PI, 50, t, 2400, 74, 70, 5241, [0, LB, W, H - 2 * LB]);
    z5Beam(W + 20, 128, HX + 100, 128, 26, voidCol(t), t, 1);
    const hero = z5Zenith(HX, HY, 5.4, t, { sw: -0.05, sq: 0.22, spread: 0.85 + 0.15 * Math.sin(t * 30), wt: t * 3, mouth: u > 0.6 ? 2 : 1, orbR: 66, auraR: 16, sparks: 30 });
    glow(hero.tip[0], hero.tip[1], 90, T_WH, 0.7); discF(hero.tip[0], hero.tip[1], 14 + Math.sin(t * 40) * 3, 22);
    for (let k = 0; k < 5; k++) if (ih(k, fl(t * 15), 5242) < 0.7) bolt(hero.tip[0], hero.tip[1], hero.tip[0] + 40 + ih(k, 1, fl(t * 15)) * 100, hero.tip[1] + (ih(k, 2, fl(t * 15)) - 0.5) * 140, fl(t * 15) + k, 1, 22, 74);
    glow(HX + 60, HY, 200, T_MAG, 0.25);
    shk(3);
    z5Cam(1 + u * 0.12, -0.04, HX + 30, HY - 10, 240, 135);
  });
  CAPS.push([98.5, 100.3, 's', 'HERO', 'FOR EVERY STORY!']);

  /* ================================================================ 11 — STRIKE (1:40.5–1:44) */
  shot(100.5, 101.35, (lt, t) => {
    gradient(LB, H - LB, [80, 62, 71, 72, 73]);
    radialLines(240, 140, 80, 50, 76, t, 5251);
    radialLines(240, 140, 50, 70, 83, t, 5252);
    radialLines(240, 140, 30, 90, 22, t, 5253);
    // the void beam, split by the blade, peeling away either side
    const sp = eoc(lt / 0.85);
    z5Beam(240, 150, -60, 150 - sp * 120, 16 + sp * 20, voidCol(t), t, 1); z5Beam(240, 150, 540, 150 - sp * 120, 16 + sp * 20, voidCol(t), t, 2);
    z5Sunburst(240, 160, 16, t * 2, 20, 260, 0.06);
    z5Zenith(240, lerp(178, 196, eic(lt / 0.85)), lerp(4.4, 6.2, eic(lt / 0.85)), t, { sw: -0.45, mouth: 2, spread: 0.8, wt: t * 4, orbR: 70, auraR: 22 + lt * 10, sparks: 40, sq: Math.sin(t * 50) * 0.05 });
    shk(4);
    z5Cam(1 + lt * 0.15, 0, 240, 170);
    zoomBlur(240, 160, 0.08 + lt * 0.1);
  });
  CAPS.push([100.5, 101.4, 'x', '', 'STRIKE!', 52]);
  shot(101.35, 101.85, (lt, t) => {
    gradient(LB, H - LB, VOIDSKY);
    spiralEye(240, 135, 160 + lt * 40, t, 1);
    const in_ = eic(lin(0, 0.06, lt));
    z5Zenith(lerp(140, 228, in_), 135, 1.6, t, { sw: 0, reach: 4, spread: 0.7, auraR: 8 });
    const g = lt - 0.06;
    if (g > 0) {
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + ih(k, 1, 5261) * 0.4; bolt(240, 135, 240 + Math.cos(a) * 300 * eoc(g / 0.3), 135 + Math.sin(a) * 300 * eoc(g / 0.3), k + 3, 2, 22, 60, 0.18); }
      glow(240, 135, 120, T_WH, 0.9);
      if (g < 0.034) flashWhite(1); else if (g < 0.134) impactFrame(240, 135, 0); else if (g < 0.2) impactFrame(240, 135, 1);
      shk(8);
    }
    z5Cam(1 + lt * 0.3, 0, 240, 135);
  });
  // the light pours out of the colossus through cracks everywhere
  const CR11 = []; for (let k = 0; k < 600 && CR11.length < 26; k++) { const lx = (ih(k, 1, 5271) - 0.5) * 120, ly = ih(k, 2, 5271) * 120 + 18; if (bodyInside(lx, ly, 0) && bodyInside(lx + 6, ly, 0) && bodyInside(lx - 6, ly, 0)) CR11.push([lx, ly, ih(k, 3, 5271) * TAU]); }
  shot(101.85, 104.0, (lt, t) => {
    const s = 2.1, f = fl(t * 30), BX = 240 + Math.round((ih(f, 1, 5281) - 0.5) * 2 * (1 + lt * 2)), BY = 86;
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 70, 5282);
    cloudBank(236, 20, 60, 5283, t * 6, [77, 78, 79, 62], false);
    unmaker(BX, BY, s, t, { eyes: 2, broken: 1.25, halo: 1 - lt * 0.3, heart: 1, shake: 2, arms: [[-50, 30, -84 + Math.sin(t * 13) * 10, -40, 1], [50, 30, 90, -30 + Math.sin(t * 11) * 10, 1]] });
    const ex = BX, ey = BY - 2 * s;
    for (let k = 0; k < 8; k++) z5Ray(ex, ey, k / 8 * TAU + t * 0.5, 90 + lt * 160, 5 + lt * 3, 22, PRISM[k % 7], 1);
    for (let k = 0; k < CR11.length; k++) {
      const g = lt - 0.05 - k * 0.07; if (g < 0) continue;
      const [lx, ly, a] = CR11[k], cx = BX + lx * s, cy = BY + ly * s, len = 6 + eoc(g / 0.2) * 14, oa = Math.atan2(cy - ey, cx - ex) + Math.sin(k) * 0.3;
      glow(cx, cy, 26 + g * 20, T_WH, 0.8);
      z5Ray(cx, cy, oa, 30 + eoc(g / 0.6) * 220, 3 + g * 4, 22, 60, 1);
      bolt(cx - Math.cos(a) * len, cy - Math.sin(a) * len, cx + Math.cos(a) * len, cy + Math.sin(a) * len, k, 3, 22, 60, 0.35);
      if (g < 0.06) shk(3);
    }
    glow(ex, ey, 70 + lt * 70, T_WH, 0.9); sparkle(ex, ey, 16 + Math.sin(t * 30) * 4 + lt * 10, 22, 60); discF(ex, ey, 6 + lt * 4, 22);
    shk(2 + lt * 2.5);
    z5Cam(1 + lt * 0.07, 0, 240, 120);
    flashWhite(sstep(1.85, 2.15, lt));
  });

  /* ================================================================ 12 — it shatters; the sky heals (1:44–1:48) */
  // the colossus as a lattice of shards (local units), each flying out from its heart
  const SH12 = [];
  for (let ly = -28; ly < 150; ly += 4.6) for (let lx = -74; lx < 74; lx += 4.6) {
    const j = ih(fl(lx * 3), fl(ly * 3), 5291), qx = lx + (j - 0.5) * 3, qy = ly + (ih(fl(lx * 3), fl(ly * 3), 5292) - 0.5) * 3;
    if (!bodyInside(qx, qy, 0) && qx * qx / 256 + qy * qy / 729 >= 1) continue;
    SH12.push({ lx: qx, ly: qy, sz: 4.2 + j * 3, rot: j * TAU * 3, w: (ih(SH12.length, 5, 5291) - 0.5) * 16, v: 0.35 + ih(SH12.length, 6, 5291) * 1.1,
      c: ih(SH12.length, 7, 5291) < 0.78 ? PRISM[((fl((qx + qy) / 14) % 7) + 7) % 7] : 77, j });
  }
  function shards12(cx, cy, s, age, t) {
    const hot = age < 0.12;
    for (const d of SH12) {
      const dx = d.lx, dy = d.ly - 40, dl = Math.hypot(dx, dy) + 8, dist = d.v * (380 * age * age + 26 * age);
      const x = cx + d.lx * s + dx / dl * dist, y = cy + d.ly * s + dy / dl * dist + 30 * age * age, r = d.sz * s * 0.5 * Math.max(0, 1 - age / 2.6), a = d.rot + d.w * age;
      if (r < 0.7 || x < -20 || x > W + 20 || y < 0 || y > H + 20) continue;
      z5Tri(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a + 2.2) * r * 0.85, y + Math.sin(a + 2.2) * r * 0.85, x + Math.cos(a + 4.1 + d.j) * r * 0.7, y + Math.sin(a + 4.1 + d.j) * r * 0.7, hot ? (d.j < 0.5 ? 22 : 60) : d.c);
      if (!hot && fl(t * 15 + d.j * 10) % 5 === 0) P(x, y, 22);
    }
  }
  shot(104.0, 105.6, (lt, t) => {
    const heal = sstep(0.15, 1.5, lt), CX = 240, CY = 86;
    gradient(LB, H - LB, VOIDSKY); stars(t, 200, 60, 5301);
    Z5C.set(BUF);
    z5Dawn(t, 196, t * 12, 360, 204);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - CX, (y - CY) * 1.2) / 420 + (vn(x, y, 16, 5302) - 0.5) * 0.12; if (d > heal * 1.15) BUF[y * W + x] = Z5C[y * W + x]; else if (d > heal * 1.15 - 0.012) BUF[y * W + x] = PRISM[((fl(Math.atan2(y - CY, x - CX) * 5 + t * 8) % 7) + 7) % 7]; }
    shockRing(CX, 214, 10 + lt * 520, (10 + lt * 520) * 0.12, 5, [22, 60, 59], 1 - lt / 1.5);
    z5Sunburst(CX, CY, 20, t * 0.6, 10, 140 + lt * 200, 0.08 * Math.max(0, 1 - lt / 1.4), [22, 60, 59]);
    shards12(CX, CY, 2.1, lt, t);
    z5Zenith(CX, CY - 4, 1.4, t, { sw: -0.6, spread: 1, auraR: 6, sparks: 10 });
    glow(CX, CY, 90 * (1 - lt / 1.6), T_WH, 0.8);
    if (lt < 0.067) flashWhite(1);
    shk(8 * Math.exp(-lt * 2.5));
    z5Cam(1.12 - 0.1 * eoc(lt / 1.6), 0, CX, CY + 20, 240, 135);
  });
  shot(105.6, 108.0, (lt, t) => {
    const open = 1 - eio(lin(0, 1.4, lt)), sun = 196 - eoc(lt / 2.4) * 18;
    z5Dawn(t, 186, t * 12, 330, sun);
    // the tear is stitched shut from the top down by a running seam of light
    const seal = eio(lin(0, 1.6, lt)), RY0 = 34, RY1 = 168, sy = lerp(RY0, RY1, seal), jagX = (y) => 250 + (vn(y, 0, 7 * 0.7, 91) - 0.5) * 21 + (vn(y, 0, 2, 92) - 0.5) * 4.9;
    if (seal < 1) { glow(250, (sy + RY1) / 2, 90, T_MAG, 0.3); z5Rift(250, sy, RY1, 0.45 * (1 - seal * 0.5), t, 0.7); }
    const fade = lin(1.6, 2.4, lt);
    for (let y = RY0; y < sy; y++) if (bay(fl(jagX(y)), y) > fade) { P(jagX(y), y, y > sy - 20 ? 22 : 60); P(jagX(y) + 1, y, 59); }
    if (seal > 0 && seal < 1) { glow(jagX(fl(sy)), sy, 50, T_WH, 0.7); sparkle(jagX(fl(sy)), sy, 10 + Math.sin(t * 40) * 3, 22, 60); }
    const sg = lt - 1.6;
    if (sg > 0 && sg < 0.5) { sparkle(jagX(RY1), RY1, 18 * (1 - sg / 0.5), 22, 60); glow(jagX(RY1), RY1, 70, T_WH, 0.7 * (1 - sg / 0.5)); }
    for (let k = 0; k < 70; k++) { const u = frac(ih(k, 1, 5311) + t * 0.12), x = ih(k, 2, 5311) * W + Math.sin(t * 1.5 + k) * 8, y = LB + u * 200; if (fl(t * 12 + k) % 5) P(x, y, PRISM[k % 7]); else sparkle(x, y, 2, 22, PRISM[k % 7]); }
    z5Zenith(164, 120 + Math.sin(t * 1.6) * 3, 1.6, t, { sw: -1.0, spread: 1, orbR: 18, auraR: 5, sparks: 8 });
    z5Cam(1.06 - 0.05 * eio(lt / 2.4), 0, 240, 135);
  });

  /* ================================================================ 13 — after: a new dawn; then the sting (1:48–1:54) */
  const SETTLE = [1.8, 2.1, 2.4, 2.7];
  shot(108.0, 111.0, (lt, t) => {
    const HX = 214, HY = 128 + Math.sin(t * 1.6) * 3, S = 3.0, calm = sstep(1.1, 1.5, lt);
    z5Dawn(t, 190, t * 8, 340, 182);
    z5GodRays(340, 182, 7, t * 0.15, T_WARM, 0.5, 380);
    const which = SETTLE.map((s) => lt < s);
    const orbR = 36, orbsAt = (front) => { for (let k = 0; k < 4; k++) { const st = SETTLE[k], u = eic(lin(st - 0.5, st, lt)); if (u >= 1) continue; const a = t * 2.4 + k * TAU / 4, z = Math.sin(a), R = orbR * (1 - u); if ((z > 0) !== front) continue; orbAt(HX + Math.cos(a) * R, HY + z * R * 0.4, k, 4, t); } };
    orbsAt(false);
    if (calm < 1) z5Wings(HX, HY - 6 * S, S * 0.6, t, 1 - eoc(calm), 0.05);
    const white = lt > 1.25 && lt < 1.4;
    actor(HERO({ form: calm < 0.5 ? 'zenith' : undefined, eyes: lt < 1.4 ? 'glow' : (lt > 2.2 && lt < 2.32 ? 'closed' : 'normal'), sword: -1.0, swordCols: calm < 0.5 ? z5Sw(t) : PRISM, fly: true }), HX, HY, S, 0, false, { white });
    aura(t, calm < 0.5 ? ZEN_AURA : AURA_GOLD, lerp(9, 2, calm), { sparks: fl(12 * (1 - calm)) });
    orbsAt(true);
    for (let k = 0; k < 4; k++) { const g = lt - SETTLE[k]; if (g > 0 && g < 0.35) { glow(HX, HY + 4, 30, EL_T[k], 0.6 * (1 - g / 0.35)); sparkle(HX, HY + 4, 8 * (1 - g / 0.35), 22, ORB[k][2]); } }
    if (white) glow(HX, HY, 60, T_WH, 0.6);
    z5Cam(1.12 + lt * 0.02, 0, HX + 20, HY, 240, 135);
  });
  CAPS.push([109.0, 111.0, 's', 'HERO', "IT'S OVER."]);
  shot(111.0, 114.0, (lt, t) => {
    gradient(LB, 150, [6, 7, 8, 13, 14, 15]);
    glow(390, 150, 150, T_WARM, 0.55);
    cloudBank(140, 34, 70, 5321, t * 5, CLOUD_SUN, false);
    cloudBank(196, 44, 50, 5322, t * 8, [17, 18, 14, 15], false);
    const LX = 236, LY = 176, fall = eic(lin(0, 0.42, lt)), sx = lerp(330, LX, fall), sy = lerp(10, LY, fall) + (lt > 0.42 ? (lt - 0.42) * 2.5 : 0);
    const ang = lt < 0.42 ? 3.1 - lt * 7 : 0.16 + Math.sin(lt * 2) * 0.02;
    const eye = eob(lin(0.5, 0.6, lt)), look = lt > 1.3 ? Math.sin((lt - 1.3) * 2.6) * 0.9 : 0;
    if (eye > 0) glow(sx + 2, sy - 2, 56 + Math.sin(t * 4) * 6, T_MAG, 0.5 * Math.min(1, eye));
    z5MaskShard(sx, sy, 2.4, ang, eye, look, t);
    // the clouds close over its lower edge
    for (let k = 0; k < 5; k++) cloudPuff(sx - 48 + k * 24, sy + 26 + (k & 1) * 5, 13 + (k % 3) * 3, [18, 19, 15, 16], 5323 + k);
    const lg = lt - 0.42;
    if (lg > 0 && lg < 0.5) for (let k = 0; k < 16; k++) { const a = -PI * (0.05 + 0.9 * ih(k, 1, 5324)), v = 60 + ih(k, 2, 5324) * 80; rectF(sx + Math.cos(a) * lg * v, sy + 20 + Math.sin(a) * lg * v * 0.6 + lg * lg * 120, 2, 2, 16); }
    if (lt > 0.5 && lt < 0.56) mapFx(INV, 1);
    const pin = eio(lin(0.6, 2.8, lt));
    z5Cam(1 + pin * 0.7, 0, lerp(240, sx - 4, pin), lerp(135, sy, pin), 240, 135);
    tintAll(T_DARK, sstep(2.4, 2.98, lt));
  });

  /* ================================================================ 14 — the title (1:54–2:00) */
  shot(114.0, 120.0, (lt, t) => {
    rectF(0, 0, W, H, 63);
    stars(t, H, 120, 5331);
    const s = 'FABLE 5.5', sc = lt < 0.08 ? 7 : 6, w = textWidth(s, sc), x0 = 240 - w / 2;
    text(s, x0, 70 - (sc - 6) * 3, (i, j, k) => (j < 2 ? 22 : EL[k % 4][j < 5 ? 2 : 1]), sc, 0);
    if (lt < 0.1) flashWhite(0.8 * (1 - lt / 0.1));
    if (lt > 0.7) { const s2 = 'PART III · THE UNMAKER'; text(s2, 240 - textWidth(s2, 2) / 2, 132, 59, 2, 0, fl((lt - 0.7) * 30)); }
    if (lt > 1.6) { const s3 = 'TO BE CONTINUED'; text(s3, 240 - textWidth(s3, 1) / 2, 162, 19, 1, undefined, fl((lt - 1.6) * 30)); }
    actor(HERO({ eyes: 'normal', sword: -1.0, swordCols: z5Sw(t * 0.3) }), 240, 210, 1.4, 0, false);
  });
  }

  /* ================================================================ captions */
  // [t0, t1, kind, speaker, text, y]; kinds: n narration (top bar), s speech (bottom bar), x shout (centre)

  function drawCaptions(t) {
    if (t > D - 2.4) { const s4 = 'UNOFFICIAL FAN CONCEPT · NOT AFFILIATED WITH ANTHROPIC'; text(s4, 240 - textWidth(s4, 1) / 2, H - LB + 9, 19, 1); }
    for (const [t0, t1, k, who, s, sy] of CAPS) {
      if (t < t0 || t >= t1) continue;
      const nv = Math.ceil((t - t0) * 38);
      if (k === 'n') { const w = textWidth(s, 1); text(s, 240 - w / 2, 9, 20, 1, undefined, nv); }
      else if (k === 's') {
        const tag = who + ':', tw = textWidth(tag, 1), w = tw + 6 + textWidth(s, 1), x0 = 240 - w / 2, y = H - LB + 9;
        text(tag, x0, y, who === 'UNMAKER' ? 74 : who === 'NULL' ? 42 : 35, 1);
        text(s, x0 + tw + 6, y, 21, 1, undefined, nv);
      } else {
        const u = (t - t0) / (t1 - t0), sc = u < 0.12 ? 8 : 6, w = textWidth(s, sc);
        text(s, 240 - w / 2, (sy || 135) - 3.5 * sc, (i, j) => (j < 3 ? 22 : 59), sc, 0, undefined, t);
      }
    }
  }

  /* ================================================================ frame */
  let SHX = 0, SHY = 0;
  function render(t) {
    t = clamp(t, 0, D - 1 / 30);
    T_NOW = t; SHAKE_A = 0; FRZ = 0; BUF.fill(0);
    let S = SHOTS[0];
    for (const s of SHOTS) if (t >= s.t0) S = s;
    S.fn(t - S.t0, t);
    for (const [wt, dir] of WHIPS) { const d = Math.abs(t - wt); if (d < 0.1) whip(80 * (1 - d / 0.1), dir); }
    letterbox(LB);
    for (const c of FLASH_CUTS) if (t >= c && t < c + 0.067) tintAll(T_WH, 0.55);
    if (S.post) S.post(t - S.t0, t);
    drawCaptions(t);
    const f = fl(t * 30);
    SHX = Math.round((ih(f, 1, 901) - 0.5) * 2 * SHAKE_A); SHY = Math.round((ih(f, 2, 901) - 0.5) * 2 * SHAKE_A);
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
    // whole-pixel screen shake: shift the finished frame, clamping at the edges
    const sx = SHX, sy = SHY;
    for (let y = 0; y < H; y++) {
      const yy = clamp(y - sy, 0, H - 1), o = y * W, oo = yy * W;
      for (let x = 0; x < W; x++) PIX[o + x] = LIVE[BUF[oo + clamp(x - sx, 0, W - 1)]];
    }
    SG.putImageData(IMG, 0, 0);
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#04050b'; g.fillRect(0, 0, cw, ch);
    g.drawImage(SMALL, ox, oy, W * k, H * k);
  }

  /* ================================================================ mount */
  if (typeof window !== 'undefined') window.__unmaker_core = { render, BUF, PAL, W, H, D, SHAKE: () => [SHX, SHY] };
  (window.PIECES = window.PIECES || []).push({
    id: 'the-unmaker',
    title: 'The Unmaker',
    medium: 'Pixel art in 96 colours, 480 × 270, drawn in JavaScript · 2 min',
    note: 'Fable Saga, part III · tap to pause',
    about: 'Part three of the Fable saga. The Null was only a shadow. At dawn, above the clouds, the sky tears open and the thing that made it leans through: the Unmaker, a colossus of night behind a porcelain mask, which rewinds time, folds the world and unwrites colour itself. The hero burns through Fable Mode and a new Storm Form, is stripped of every element and falls into grey nothing, and rises again as something new. An unofficial fan concept, not affiliated with Anthropic.',
    tone: 'dark',
    room: '#04050b',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, ready = false;
      el.style.background = '#04050b';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(255,230,210,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(255,230,210,.8)"/></svg>';
      el.appendChild(pauseMark);
      let K = 4, CW = W * 4, CH = H * 4;
      function layout() {
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1920; cssH = 1080; cv.style.position = 'fixed';
          K = Math.max(1, Math.round(4 * dpr)); CW = Math.round(1920 * dpr); CH = Math.round(1080 * dpr);
        } else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / W, h * dpr / H);
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
        window.__theunmaker = {
          duration: D,
          isReady: () => ready && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__theunmaker.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-unmaker';
        api.ready();
      } else {
        window.__theunmaker = { duration: D, isReady: () => ready, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
        api.ready();
      }
      let hold = 0;
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        if (clock >= D) { hold += dt; if (hold < 2.5) return; hold = 0; clock = 0; } // a short rest on the last frame, then again
        clock = Math.min(D, clock + dt);
        draw(Math.min(clock, D - 1 / 30));
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; layout(); draw(Math.min(clock, D - 1 / 30)); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__theunmaker) delete window.__theunmaker;
        },
      };
    },
  });

})();
