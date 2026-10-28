/* The Sunderer — Fable Saga, part IV.
 *
 * A three-minute pixel-art action short. One eye in a shard of the Unmaker's mask still watched, and its brother answered:
 * the Sunderer, who does not erase but breaks. The hero is pushed past every limit it has. Every frame is a pure
 * function of t, drawn into a 480 × 270 indexed buffer in 124 colours and shown at 4×; the film is cut as a sequence of shots, each with its own camera, with captions on top.
 * Built from the parts in fable-saga/production/part4/src. An unofficial fan concept, not affiliated with Anthropic.
 */
(function () {
  'use strict';
  /* ================================================================ constants & helpers */
  const W = 480, H = 270, NP = W * H, D = 180;
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
    // part IV
    '0a0506', '170b0b', '2a1414', '42201e', '5e302a',                                             // 96-100 obsidian (the Sunderer's body)
    '4a0606', '7e0c0c', 'b8170f', 'f0301a', 'ff6a24', 'ffb03a', 'ffe6a0',                         // 101-107 crimson to molten to white-hot
    'fff7e8', 'ffd890', 'ff9440',                                                                 // 108-110 nova (a star's body)
    '1e1412', '3a2622', 'ff4a30',                                                                 // 111-113 last light (charred, ember)
    '03090f', '071623', '0e2a3c', '1c4a62', '3e7c96', 'a6dcea',                                   // 114-119 the ocean under the clouds
    '2a2224', '4a3e3c', '74645e', 'a8968c',                                                       // 120-123 ash and broken rock
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
  const PRISM_C = [81, 82, 83, 84, 85, 86, 87];
  // seams across the body for o.cracks: each a jagged path from an edge inward (u, v in 0..1), appearing at level 'at'
  const CRACKS = [];
  for (let k = 0; k < 9; k++) {
    const side = k % 4, p = [], at = k / 9, w = k % 3 === 0;
    let u = side === 0 ? 0 : side === 1 ? 1 : 0.15 + ih(k, 1, 931) * 0.7, v = side === 2 ? 0 : side === 3 ? 1 : 0.15 + ih(k, 2, 931) * 0.7;
    const du = side === 0 ? 1 : side === 1 ? -1 : 0, dv = side === 2 ? 1 : side === 3 ? -1 : 0;
    p.push([u, v]);
    for (let q = 0; q < 4; q++) { u = clamp(u + du * (0.1 + ih(k, q, 932) * 0.12) + (ih(k, q, 933) - 0.5) * 0.16, 0, 1); v = clamp(v + dv * (0.12 + ih(k, q, 934) * 0.14) + (ih(k, q, 935) - 0.5) * 0.2, 0, 1); p.push([u, v]); }
    CRACKS.push({ p, at, w });
  }
  const FORMS = { storm: [90, 89, 91, 91], grey: [94, 93, 95, 92], zenith: [60, 59, 22, 22], nova: [108, 110, 22, 105], lastlight: [111, 96, 113, 104], infinite: [60, 85, 22, 22] };
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
    // legs bend: legSh slides the feet sideways (trailing behind a move), row by row so the leg leans rather than jumps
    const shx = o.legSh || 0;
    for (let k = 0; k < 4; k++) { const n = Math.max(1, lh - lift[k]), lc = !N && (k === 1 || k === 2) ? dark : body; for (let j = 0; j < n; j++) spRect(lx[k] + Math.round(shx * (j + 1) / lh), y1 + j, 4, 1, lc, 1); }
    // body with a little shading (flat, as in the reference, just a lit top edge and a darker base)
    spRect(x0, y0, bw, bh, body, 1);
    for (let i = 0; i < bw; i++) { sp(x0 + i, y1 - 1, dark, 1); if (!N || o.shade) sp(x0 + i, y0, lite, 1); if (!N && (i & 1)) sp(x0 + i, y1 - 2, dark, 1); }
    if (!N) { for (let j = 1; j < bh - 1; j++) { sp(x0 + bw - 1, y0 + j, dark, 1); if (j & 1) sp(x0 + bw - 2, y0 + j, dark, 1); } sp(x0 + 1, y0 + 1, lite, 1); sp(x0 + 2, y0 + 1, lite, 1); sp(x0 + 1, y0 + 2, lite, 1); }
    // part IV forms paint the body: nova burns white at the core out to a molten rim; infinite runs bands of every colour
    // across a white body; last light is a charred shell split by seams of fire
    const tf = T_NOW;
    if (o.form === 'nova') for (let j = 1; j < bh - 1; j++) for (let i = 1; i < bw - 1; i++) { const u = (i + 0.5) / bw - 0.5, v = (j + 0.5) / bh - 0.5, r = Math.sqrt(u * u * 1.4 + v * v) + Math.sin(Math.atan2(v, u) * 5 + tf * 9) * 0.03; sp(x0 + i, y0 + j, r < 0.2 ? 22 : r < 0.33 ? 108 : r < 0.42 ? 109 : 110, 1); }
    if (o.form === 'infinite') for (let j = 1; j < bh - 1; j++) for (let i = 1; i < bw - 1; i++) { const b = (i + j * 0.6) / 5 - tf * 6, f = frac(b); if (f < 0.22) sp(x0 + i, y0 + j, PRISM_C[((fl(b) % 7) + 7) % 7], 1); else if (f < 0.32) sp(x0 + i, y0 + j, 22, 1); }
    const crk = Math.max(o.cracks || 0, o.form === 'lastlight' ? 0.85 : 0);
    if (crk > 0) {
      // cracks: jagged seams from the edges inward, more of them (and longer) as crk grows; light pours out of them
      const lc = F ? (o.form === 'lastlight' ? (fl(tf * 20) % 3 ? 107 : 22) : 22) : 107, lc2 = o.form === 'lastlight' ? 104 : F ? F[2] : 103;
      for (let k = 0; k < CRACKS.length; k++) {
        const C = CRACKS[k]; if (C.at > crk) continue;
        const grow = clamp((crk - C.at) / 0.25, 0, 1), n = Math.max(2, Math.ceil(C.p.length * grow));
        for (let q = 0; q + 1 < n; q++) { const [ua, va] = C.p[q], [ub, vb] = C.p[q + 1]; for (let m = 0; m <= 6; m++) { const u = lerp(ua, ub, m / 6), v = lerp(va, vb, m / 6), px = x0 + u * (bw - 1), py = y0 + v * (bh - 1); sp(px, py, q === 0 ? lc2 : lc, 1); if (C.w && m % 2 === 0) sp(px + 1, py, lc2, 1); } }
      }
    }    // arms
    const ay = y0 + Math.round(bh * 0.34), ah = Math.max(3, Math.round(bh * 0.32)), ar = Math.round(o.reach || 0);
    const hasSw = o.sword !== undefined && o.sword !== null, armA = hasSw ? clamp(o.sword * 0.45, -1.1, 0.9) : 0;
    const limbS = (sx, sy, a, len, c) => { const ca = Math.cos(a), sa = Math.sin(a); for (let q = 0; q <= len; q += 0.5) for (let v = -ah / 2 + 0.25; v < ah / 2; v += 0.5) sp(sx + ca * q - sa * v, sy + sa * q + ca * v, c, 1); };
    const shY = ay + ah / 2 - 0.5;
    limbS(x0 + 1, shY, PI - armA * 0.6, 4.5, N ? body : dark); limbS(x0 + bw - 1, shY, armA, 3.5 + ar, body);
    const handX = x0 + bw - 1 + Math.cos(armA) * (3 + ar), handY = shY + Math.sin(armA) * (3 + ar);
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
      if (e === 'glow') { spRect(ex - 1, ey - 1, 4, 5, o.form === 'storm' ? 61 : o.form === 'zenith' ? 84 : o.form === 'nova' ? 105 : o.form === 'lastlight' ? 104 : o.form === 'infinite' ? 85 : 59, 1); spRect(ex, ey, 2, 3, 22, 1); return; }
      if (e === 'wide') { spRect(ex - 1, ey - 1, 3, 4, EC, 1); sp(ex - 1, ey - 1, 22, 1); return; }
      if (!N && (e === 'normal' || e === 'angry')) { spRect(ex, ey, 2, 3, EC, 1); sp(ex + (side < 0 ? 0 : 1), ey, 22, 1); if (e === 'angry') { const inner = side < 0 ? ex + 1 : ex; sp(inner + side * -1, ey - 1, 0, 1); sp(inner + side * -1 + (side < 0 ? 1 : -1), ey - 2, 0, 1); } return; }
      if (e === 'narrow') { spRect(ex, ey + 1, 2, 2, EC, 1); return; }
      spRect(ex, ey, 2, 3, EC, 1);
      if (e === 'angry' || N) { const inner = side < 0 ? ex + 1 : ex; sp(inner + side * -1, ey - 1, N ? 42 : 0, 1); sp(inner + side * -1 + (side < 0 ? 1 : -1), ey - 2, N ? 42 : 0, 1); sp(ex + (side < 0 ? 0 : 1), ey, body, 1); }
    };
    eye(ex0, -1); eye(ex1, 1);
    if (o.mouth) { const mw = o.mouth > 1 ? 8 : 4, mh = o.mouth > 1 ? 4 : 2; spRect(-mw / 2, ey + 5, mw, mh, N ? 42 : 0, 1); if (N) for (let i = -mw / 2; i < mw / 2; i += 2) sp(i, ey + 5, 39, 1); else if (o.mouth > 1) spRect(-mw / 2 + 1, ey + 5 + mh - 1, mw - 2, 1, 36, 1); }
    // sword on the right arm nub
    if (hasSw) spSword(handX, handY, o.sword, o.swordCols || null);
    // outline
    const oc = o.outline !== undefined ? o.outline : N ? 42 : F ? F[3] : 22, prism = o.form === 'zenith' || o.form === 'infinite', pf = fl(T_NOW * 12);
    const src = SPR.slice();
    for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
      const i = y * SW + x; if (src[i]) continue;
      if (src[i - 1] || src[i + 1] || src[i - SW] || src[i + SW]) { SPR[i] = (SPK[i - 1] === 2 || SPK[i + 1] === 2 || SPK[i - SW] === 2 || SPK[i + SW] === 2 ? (N ? 42 : 1) : prism ? 81 + ((((x + y) >> 1) + pf) % 7) : oc) + 1; SPK[i] = 4; }
    }
    LBB[0]--; LBB[1]--; LBB[2]++; LBB[3]++;
    return { bw, bh, hand: [handX, handY + 0.5], top: y0, bottom: y1 + lh };
  }
  // stamp the built sprite at screen (x, y), scale S, angle (radians), mirrored if flip
  const SMASK = new Uint8Array(NP), SMB = [0, 0, 0, 0];
  function stamp(x, y, S, ang, flip, opt) {
    opt = opt || {};
    const ca = Math.cos(ang), sa = Math.sin(ang);
    // stretch: st > 0 pulls the sprite long along screen angle sd (and thin across it), st < 0 squashes it; area is kept
    const st = opt.st || 0, k1 = 1 + st, k2 = Math.sqrt(k1), su = Math.cos(opt.sd || 0), sv = Math.sin(opt.sd || 0);
    let R = 0;
    for (const [lx, ly] of [[LBB[0], LBB[1]], [LBB[2] + 1, LBB[1]], [LBB[0], LBB[3] + 1], [LBB[2] + 1, LBB[3] + 1]]) R = Math.max(R, Math.hypot(lx, ly));
    R = R * S * Math.max(k1, 1 / k2) + 2;
    const x0 = Math.max(0, fl(x - R)), x1 = Math.min(W - 1, Math.ceil(x + R)), y0 = Math.max(0, fl(y - R)), y1 = Math.min(H - 1, Math.ceil(y + R));
    if (!opt.keepMask) { SMB[0] = W; SMB[1] = H; SMB[2] = -1; SMB[3] = -1; }
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
      let dx = X + 0.5 - x, dy = Y + 0.5 - y;
      if (st) { const a = (dx * su + dy * sv) / k1, b = (-dx * sv + dy * su) * k2; dx = a * su - b * sv; dy = a * sv + b * su; }
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
  /* ---------------------------------------------------------------- life: what keeps a drawn block from moving like a cut-out
     Every hero draw passes through here. Each draw in a frame keeps its own little physics (by call order inside the shot):
     it leans into its motion and overshoots when it stops, stretches along its path and lands in a squash that wobbles out,
     its feet trail behind, its sword follows the hand a beat late and swings past, and when it is still it hovers, breathes,
     paddles its feet and blinks. A jump cut inside a shot (a blink-fast dash) arrives stretched along the jump. */
  const LIFE = { t: -1, dt: -1, shot: null, n: 0, s: [] };
  function lifeTick(t, shot) {
    const dt = t - LIFE.t;
    LIFE.dt = shot !== LIFE.shot || dt < 0 || dt > 0.1 ? -1 : dt;      // -1: start over (a cut, a seek); 0: same frame again
    LIFE.t = t; LIFE.shot = shot; LIFE.n = 0;
  }
  function spring(L, key, target, k, z, dt) {
    let x = L[key], v = L[key + 'v'];
    const c = 2 * z * Math.sqrt(k), n = Math.ceil(dt * 240), h = dt / n;
    for (let i = 0; i < n; i++) { v += (k * (target - x) - c * v) * h; x += v * h; }
    L[key] = x; L[key + 'v'] = v; return x;
  }
  function life(o, x, y, S, ang, flip, opt) {
    const slot = LIFE.n++, t = T_NOW, dt = LIFE.dt, sw = typeof o.sword === 'number' ? o.sword : null;
    let L = LIFE.s[slot];
    if (!L || dt < 0 || Math.abs(S - L.S) > L.S * 0.5) {
      L = LIFE.s[slot] = { px: x, py: y, vx: 0, vy: 0, lean: 0, leanv: 0, st: 0, stv: 0, sd: 0, leg: 0, legv: 0, sw: sw === null ? 0 : sw, swv: 0, hasSw: sw !== null, S, idle: 1 };
    } else if (dt > 0) {
      const dx = x - L.px, dy = y - L.py;
      if (Math.hypot(dx, dy) > Math.max(45, 16 * S)) { L.vx = 0; L.vy = 0; L.sd = Math.atan2(dy, dx); L.st = 0.5; L.stv = 0; L.lean = 0; L.leanv = 0; }
      else { L.vx += (dx / dt - L.vx) * 0.6; L.vy += (dy / dt - L.vy) * 0.6; }
      const sp = Math.hypot(L.vx, L.vy);
      spring(L, 'lean', clamp(L.vx / 1100, -0.42, 0.42), 120, 0.32, dt);
      if (sp > 40) { let da = Math.atan2(L.vy, L.vx) - L.sd; da = Math.atan2(Math.sin(da), Math.cos(da)); L.sd += da * Math.min(1, dt * 14); }
      spring(L, 'st', clamp((sp - 60) / 1500, 0, 0.42), 260, 0.22, dt);
      const lvx = (L.vx * Math.cos(ang) + L.vy * Math.sin(ang)) * (flip ? -1 : 1);
      spring(L, 'leg', clamp(-lvx / (60 * S), -3, 3), 90, 0.28, dt);
      if (sw !== null) {
        if (!L.hasSw) { L.sw = sw; L.swv = 0; L.hasSw = true; }
        let tg = sw; while (tg - L.sw > PI) tg -= TAU; while (tg - L.sw < -PI) tg += TAU;
        spring(L, 'sw', tg, 900, 0.4, dt);
      } else L.hasSw = false;
      L.idle += ((sp < 90 ? 1 : 0) - L.idle) * Math.min(1, dt * 3);
      L.px = x; L.py = y; L.S = S;
    }
    const n = L.idle, ph = slot * 1.7, o2 = Object.assign({}, o);
    if (sw !== null && L.hasSw) { o2.sword = L.sw; o2.reach = (o.reach || 0) + clamp(Math.abs(L.swv) / 9, 0, 4); }
    o2.legSh = (o.legSh || 0) + clamp(L.leg, -3, 3) + Math.sin(t * 4.2 + ph) * 0.7 * n;
    if (!o.legs) { const a = t * 6.5 + ph; o2.legs = [0, 1, 2, 3].map((k) => Math.max(0, Math.sin(a + k * 1.6)) * 1.2 * n); }
    o2.sq = (o.sq || 0) + Math.sin(t * 3.1 + ph) * 0.05 * n;
    const e = o.eyes || 'normal';
    if (e === 'normal' || e === 'angry' || e === 'wide' || e === 'narrow') { const P = 2.8 + ih(slot, 1, 77) * 1.5, q = (t + ih(slot, 2, 77) * P) % P; if (q < 0.1) o2.eyes = 'closed'; }
    const bob = opt.bob !== undefined ? opt.bob : Math.sin(t * 2.3 + ph) * 0.6 * S * n;
    return { o: o2, x, y: y + bob, ang: ang + L.lean, L, opt: Object.assign({}, opt, { st: Math.abs(L.st) > 0.02 ? L.st : 0, sd: L.sd }) };
  }
  function clearMask() { if (SMB[2] >= SMB[0]) for (let y = SMB[1]; y <= SMB[3]; y++) SMASK.fill(0, y * W + SMB[0], y * W + SMB[2] + 1); SMB[0] = W; SMB[1] = H; SMB[2] = -1; SMB[3] = -1; }
  // a character in one call: build, optional ghosts and glitch, stamp; returns where its hand and sword tip are
  function actor(o, x, y, S, ang, flip, opt) {
    opt = opt || {};
    let LF = null;
    if (o.who === 'hero' && !opt.still) { const L = life(o, x, y, S, ang, flip, opt); x = L.x; y = L.y; ang = L.ang; opt = L.opt; o = L.o; LF = L.L; }
    const g = buildSprite(o);
    clearMask();
    if (o.who === 'null' && !opt.clean) { // chromatic ghosts either side
      const off = Math.max(1, Math.round(S * 1.2)) + (fl(T_NOW * 12) % 3 === 0 ? 1 : 0);
      stamp(x - off, y, S, ang, flip, { color: 61, alpha: 0.35, noMask: true });
      stamp(x + off, y, S, ang, flip, { color: 42, alpha: 0.35, noMask: true });
    }
    if (opt.after) for (let k = opt.after.length - 1; k >= 0; k--) { const a = opt.after[k]; stamp(a[0], a[1], S, ang, flip, { color: a[2], alpha: a[3], noMask: true, st: opt.st, sd: opt.sd }); }
    stamp(x, y, S, ang, flip, opt);
    if (o.who === 'null' && !opt.clean) glitchRows(T_NOW, Math.max(2, Math.round(S * 1.5)) * (1 + (opt.glitch || 0) * 3), opt.glitch ? 0.6 : 0.18);
    const c = Math.cos(ang), s = Math.sin(ang), hx = (flip ? -1 : 1) * g.hand[0] * S, hy = g.hand[1] * S;
    let hdx = hx * c - hy * s, hdy = hx * s + hy * c;
    if (opt.st) { const su = Math.cos(opt.sd), sv = Math.sin(opt.sd), k1 = 1 + opt.st, a = (hdx * su + hdy * sv) * k1, b = (-hdx * sv + hdy * su) / Math.sqrt(k1); hdx = a * su - b * sv; hdy = a * sv + b * su; }
    const hand = [x + hdx, y + hdy];
    const sw = o.sword !== undefined && o.sword !== null ? o.sword : 0, da = flip ? PI - sw : sw, tipL = 29 * S;
    const tip = [hand[0] + Math.cos(da + ang) * tipL, hand[1] + Math.sin(da + ang) * tipL];
    // a fast stroke leaves its slash in the air: a crescent from where the blade was a frame ago to where it is
    if (LF && o.sword !== undefined && o.sword !== null) {
      const a1 = da + ang;
      if (LF.lastA !== undefined && LIFE.dt > 0 && !opt.noSmear) {
        let d = a1 - LF.lastA; d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) > 0.28) smearArc(hand[0], hand[1], a1 - d * Math.min(1.6, 1 + Math.abs(d)), a1, tipL * 1.02, opt.smear || SMEAR_OF[o.form || 'gold']);
      }
      if (LIFE.dt !== 0) LF.lastA = a1;
    }
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
  function flashWhite(a) { if (a <= 0) return; tintAll(T_WH, Math.min(a, 0.86)); }

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
  const SMEAR_OF = { gold: SM_GOLD, storm: [89, 90, 91], grey: [93, 94, 95], zenith: [83, 60, 22] };
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
    // it is alive: the whole colossus rises and sinks on a slow breath, and the mask sways and tilts on its neck a beat
    // behind the body (o.still turns this off; o.tilt adds a deliberate tilt, o.nod a deliberate dip of the head)
    const live = o.still ? 0 : 1, breath = Math.sin(t * 1.1);
    cy += breath * 0.8 * s * live;
    const mcx = cx + (Math.sin(t * 0.7) * 0.7 * s) * live, mcy = cy + (Math.sin(t * 1.1 - 0.9) * 0.5 * s + (o.nod || 0) * s) * live;
    const tilt = (Math.sin(t * 0.53) * 0.045 + Math.sin(t * 1.37) * 0.015) * live + (o.tilt || 0), cT = Math.cos(tilt), sT = Math.sin(tilt);
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
      const [sx, sy, hx0, hy0, spread] = A, hx = hx0 + Math.sin(t * 0.9 + sx * 0.1) * 2.2 * live, hy = hy0 + Math.cos(t * 0.75 + sx * 0.1) * 1.6 * live, [ax, ay] = L(sx, sy), [bx, by] = L(hx, hy), mx = (ax + bx) / 2 + (by - ay) * 0.18, my = (ay + by) / 2 - (bx - ax) * 0.18;
      for (const [p0, p1, w] of [[[ax, ay], [mx, my], 5], [[mx, my], [bx, by], 3.5]]) { thick(p0[0], p0[1], p1[0], p1[1], Math.max(2, w * s + 2), 73); thick(p0[0], p0[1], p1[0], p1[1], Math.max(1, w * s), 77); }
      discF(mx, my, 3 * s, 74); discF(mx, my, 2 * s, 77);
      const ha = Math.atan2(by - my, bx - mx);
      discF(bx, by, 4.5 * s, 66); discF(bx - Math.cos(ha) * s, by - Math.sin(ha) * s, 3.5 * s, 65);
      for (let f = -2; f <= 2; f++) {
        const fa = ha + f * (0.28 + (spread || 0) * 0.25), L1 = (7 + (f === 0 ? 2 : 0) - Math.abs(f)) * s, bend = (spread || 0) * 0.5 + 0.3 + Math.sin(t * 2.1 + f * 0.9 + sx) * 0.14 * live;
        const k1 = [bx + Math.cos(fa) * 4 * s, by + Math.sin(fa) * 4 * s], k2 = [k1[0] + Math.cos(fa) * L1, k1[1] + Math.sin(fa) * L1], k3 = [k2[0] + Math.cos(fa + bend) * L1 * 0.8, k2[1] + Math.sin(fa + bend) * L1 * 0.8];
        thick(k1[0], k1[1], k2[0], k2[1], Math.max(1, 1.6 * s), 65); thick(k2[0], k2[1], k3[0], k3[1], Math.max(1, 1.3 * s), 66);
        P(k2[0], k2[1], 68); P(k3[0], k3[1], 69);
      }
    }
    // the mask (or what is left of it)
    const brk = o.broken || 0, sh = o.shake ? (Math.sin(t * 41) * 0.45 + Math.sin(t * 67 + 1.3) * 0.35 + (ih(fl(t * 30), 5, 704) - 0.5) * 0.25) * o.shake : 0;
    if (brk > 0) spiralEye(mcx, mcy - 2 * s, 22 * s * (0.6 + 0.4 * eoc(brk)), t, eoc(brk));
    const RX = 16 * s, RY = 27 * s, x0 = Math.max(0, fl(mcx - RX - 4 - 3 * s - brk * 60 * s)), x1 = Math.min(W - 1, Math.ceil(mcx + RX + 4 + 3 * s + brk * 60 * s)), y0 = Math.max(0, fl(mcy - RY - 4)), y1 = Math.min(H - 1, Math.ceil(mcy + RY + 4 + brk * 90 * s));
    const eyes = o.eyes === undefined ? 1 : o.eyes, crack = o.crack || 0, smile = o.smile || 0, grin = o.grin || 0, look = o.look || [0, 0];
    const SOCK = [[-6.5, -4, -0.38], [6.5, -4, 0.38]], CRACK = [[11, -26], [8, -19], [10, -14], [5, -8], [7, -3], [2, 3], [3, 9], [-2, 16], [-1, 22]];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5 - mcx - sh, qy = y + 0.5 - mcy;
      let lx = (qx * cT + qy * sT) / s, ly = (-qx * sT + qy * cT) / s;
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
    if (eyes > 0.5 && o.glow !== 0 && brk < 0.3) { const ga = (o.glow === undefined ? 0.3 : o.glow) * Math.min(1.4, eyes); for (const [ex, ey] of [[-6.5, -4], [6.5, -4], [0, -16]]) glow(mcx + (ex * cT - ey * sT) * s, mcy + (ex * sT + ey * cT) * s, 7 * s * (eyes > 1 ? 1.4 : 1), T_MAG, ga); }
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

  /* ================================================================ the kit: helpers carried over from part III
     (part III's openers, round one and finale helpers, unchanged; see fable-saga/production/part3/src) */
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


  const blinkN = (t) => frac(t / 2.7) < 0.05;
  const fadeIn = (lt, d) => { if (lt < d) tintAll(T_DARK, 1 - eio(lt / d)); };
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

  // a giant porcelain finger: a chain of shaded, tapering segments, each turned by curl from the one before
  function fingerChain(x, y, a, lens, r, curl) {
    const pts = [[x, y, r]]; let px = x, py = y, aa = a, rr = r;
    for (const L of lens) { const n = Math.ceil(L / 2); for (let k = 1; k <= n; k++) { px += Math.cos(aa) * L / n; py += Math.sin(aa) * L / n; pts.push([px, py, rr * (1 - 0.18 * k / n)]); } rr *= 0.82; aa += curl; pts.push(null); }
    for (const pass of [0, 1, 2]) for (const q of pts) { if (!q) continue; const [qx, qy, qr] = q; if (pass === 0) discF(qx, qy, qr + 1.6, 69); else if (pass === 1) discF(qx, qy, qr, 65); else discF(qx - qr * 0.25, qy - qr * 0.3, qr * 0.45, 64); }
    // the knuckle creases
    let k = 0; for (let i = 0; i < pts.length; i++) if (!pts[i] && i > 0 && i < pts.length - 1) { const [qx, qy, qr] = pts[i - 1]; thick(qx - qr * 0.6, qy, qx + qr * 0.6, qy, 2, 67); k++; }
  }
  const Z5B = new Uint8Array(NP), Z5C = new Uint8Array(NP);   // spare frames: dissolves, fades, split skies
  const PRISM = [81, 82, 83, 84, 85, 86, 87], ZEN_AURA = [59, 60, 22, 22];
  // the zenith flame: hot gold with a violet fringe, so the white body keeps its edge against it (and against the bloom)
  const ZEN_FLAME = [62, 58, 59, 60];
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
      orbAt(cx + Math.cos(a) * R, cy + z * R * tilt, k, r * (0.98 + 0.14 * z), t);          // nearer is bigger, smoothly
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
  // a wingbeat: a quick downstroke and a slower recovery (the phase is skewed); returns -1 (down) .. 1 (up)
  const z5Beat = (t) => Math.sin(t * 3 - 0.5 * Math.cos(t * 3));
  // the body rides the wings: it is lifted on the downstroke and sinks while they recover (in pixels, for scale S)
  const z5Bob = (t, S, flap) => z5Beat(t) * Math.min(1, (flap === undefined ? 0.24 : flap) / 0.24) * 0.9 * S;
  function z5Wings(x, y, s, t, spread, flap) {
    if (spread <= 0.02) return;
    const amp = flap === undefined ? 0.24 : flap, sh = fl(t * 8);
    glow(x, y - 8 * s, 70 * s * spread, T_GOLD, 0.3 * spread);
    for (const sd of [-1, 1]) {
      const beat = z5Beat(t) * amp, arm = -0.78 - beat + (1 - spread) * 1.3, ax = Math.cos(arm) * sd, ay = Math.sin(arm), Lw = 40 * s * (0.35 + 0.65 * spread);
      const RANKS = [[9, 1, 0], [8, 0.62, 1], [7, 0.36, 2]];
      for (const [N, len, rank] of RANKS) for (let j = N - 1; j >= 0; j--) {
        const u = (j + 0.6) / N, bx = x + ax * Lw * u, by = y + ay * Lw * u - Math.sin(u * PI) * 5 * s;
        const bu = z5Beat(t - 0.12 * u) * amp, fr = lerp(PI / 2 - 0.12, -0.15 - bu * 1.5, Math.pow(u, 1.25)) - (1 - spread) * 0.5, fa = sd > 0 ? fr : PI - fr;
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
    const wt = o.wt === undefined ? t : o.wt, bob = z5Bob(wt, S, o.flap) * sp;
    z5Wings(x - Math.sin(ang) * 6 * S, y + bob - Math.cos(ang) * 6 * S, S * (o.ws || 0.6), wt, sp, o.flap);
    const a = actor(HEROZ({ eyes: o.eyes || 'glow', mouth: o.mouth, sword: o.sw, swordCols: z5Sw(t), legs: o.legs, sq: o.sq, reach: o.reach }), x, y, S, ang, !!o.flip, { white: o.white, after: o.after, bob });
    z5Eyes();
    if (o.rim) z5Rim(o.rim[0], o.rim[1], o.rim[2], Math.max(2, S * 1.4));
    aura(t, o.auraC || ZEN_FLAME, o.auraR || 3 * S, { sparks: o.sparks === undefined ? 12 : o.sparks, rise: o.rise });
    if (!o.white) z5Rim(0, 0, null, 0, 63);
    if (o.orbR) z5Orbs(x, y, o.orbR, t, o.orbr || S * 1.3, o.tilt || 0.38, true);
    return a;
  }
  /* -------------------------------------------------------------- the duel: a fighter that is a pure function of its track
     The fight shots drive the hero from key tracks without life() (whose springs are stateful): every lean, stretch, reach
     and slash trail here is computed from the track itself, so a hit-stop (the track clock held) freezes the whole pose,
     smear and all, and any frame can be seeked. */
  const Z5NUM = NUMF.concat(['spread', 'flap']);
  const EQ = (u) => u * u;                                 // a swing: accelerating all the way into the hit
  // trk() with ease functions allowed, and arcs: a segment whose end key time is in keys.arcs travels on a bow of that
  // many px (positive bows to the left of the direction of travel)
  function z5Trk(keys, t) {
    if (typeof keys === 'function') return keys(t);         // (a pose can also be a function of time)
    let k = 0; while (k < keys.length - 1 && keys[k + 1].t <= t) k++;
    const A = keys[k], B = keys[k + 1], o = Object.assign({}, A);
    if (B && t > A.t) {
      const u = (typeof B.e === 'function' ? B.e : EASE[B.e || 'io'])(clamp((t - A.t) / (B.t - A.t), 0, 1));
      for (const f of Z5NUM) if (typeof A[f] === 'number' && typeof B[f] === 'number') o[f] = A[f] + (B[f] - A[f]) * u;
      const arc = keys.arcs && keys.arcs.get(B.t);
      if (arc) { const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, b = Math.sin(PI * u) * arc; o.x += dy / L * b; o.y -= dx / L * b; }
    }
    return o;
  }
  // a pose with its motion: velocity, a lean and a stretch along the path, the blade's world angle and how fast it turns
  function z5Pose(keys, tt) {
    const p = z5Trk(keys, tt), q = z5Trk(keys, tt - 1 / 30), r = z5Trk(keys, tt - 0.1);
    const vx = (p.x - q.x) * 30, vy = (p.y - q.y) * 30, sp = Math.hypot(vx, vy), svx = (p.x - r.x) * 10;
    p.vx = vx; p.vy = vy; p.sp = sp; p.svx = svx;
    p.st = clamp((sp - 110) / 1250, 0, 0.42); p.sd = Math.atan2(vy, vx);
    p.lean = clamp(svx / 2600, -0.16, 0.16);
    p.ang = (p.a || 0) + p.lean;
    p.wa = (p.sw || 0) + p.ang;
    const qa = (q.sw || 0) + (q.a || 0) + clamp((q.x - z5Trk(keys, tt - 0.1 - 1 / 30).x) * 10 / 2600, -0.16, 0.16);
    p.swv = (p.wa - qa) * 30;                               // rad/s, signed
    p.reachT = (p.reach || 0) + clamp(Math.abs(p.swv) / 9, 0, 4);
    return p;
  }
  // where buildSprite puts the hand for this pose (scale S, after the stretch), and a point a fraction f along the blade
  function z5HandP(p, S) {
    const sq = p.sq || 0, bw = Math.round(26 * (1 + sq * 0.5) / 2) * 2, bh = Math.max(10, Math.round(16 * (1 - sq * 0.4)));
    const y0 = -Math.round(bh / 2), ah = Math.max(3, Math.round(bh * 0.32)), shY = y0 + Math.round(bh * 0.34) + ah / 2 - 0.5;
    const armA = clamp((p.sw || 0) * 0.45, -1.1, 0.9), r = 3 + (p.reachT || 0);
    const lx = (bw / 2 - 1 + Math.cos(armA) * r) * S, ly = (shY + Math.sin(armA) * r + 0.5) * S, c = Math.cos(p.ang), s = Math.sin(p.ang);
    let dx = lx * c - ly * s, dy = lx * s + ly * c;
    if (p.st) { const su = Math.cos(p.sd), sv = Math.sin(p.sd), k1 = 1 + p.st, a = (dx * su + dy * sv) * k1, b = (-dx * sv + dy * su) / Math.sqrt(k1); dx = a * su - b * sv; dy = a * sv + b * su; }
    return [p.x + dx, p.y + dy];
  }
  const z5Blade = (p, S, f) => { const h = z5HandP(p, S); return [h[0] + Math.cos(p.wa) * 29 * S * f, h[1] + Math.sin(p.wa) * 29 * S * f]; };
  // a slash trail: a crescent swept about (hx, hy) from a0 through d radians (signed, may go round more than once is
  // capped at a full turn); thick and white at its leading edge, a band of prism colour across it, thinning and
  // dissolving into its tail; fade 0 (fresh) .. 1 (gone)
  function z5Arc(hx, hy, a0, d, L, fade) {
    const ad = Math.min(Math.abs(d), TAU - 0.05); if (ad < 0.3 || fade >= 1) return;
    const R = L * 1.1, x0 = Math.max(0, fl(hx - R)), x1 = Math.min(W - 1, Math.ceil(hx + R)), y0 = Math.max(LB, fl(hy - R)), y1 = Math.min(H - LB - 1, Math.ceil(hy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (SMASK[i]) continue;
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy, r = Math.sqrt(dx * dx + dy * dy);
      if (r > R || r < L * 0.42) continue;
      let rel = Math.atan2(dy, dx) - a0; rel = d > 0 ? ((rel % TAU) + TAU) % TAU : ((-rel % TAU) + TAU) % TAU;
      if (rel > ad) continue;
      const u = rel / ad, rin = L * (1 - 0.52 * Math.pow(u, 1.6)), rout = L * (1.02 + 0.06 * u);
      if (r < rin || r > rout) continue;
      const e = (r - rin) / (rout - rin), b = bay(x, y);
      if (b > u * 1.8 - fade * 1.9) continue;                          // the tail (and, as it fades, all of it) dissolves
      BUF[i] = (e > 0.8 && u > 0.5) || u > 0.93 ? 22 : u > 0.7 ? (e > 0.45 ? 60 : PRISM[fl(e * 6.99)]) : PRISM[fl(e * 6.99)];
    }
  }
  // the trail of the last few frames of a track's blade: only the fast part of the stroke, shrinking from its tail as the
  // stroke ages out (a held track holds it)
  function z5Trail(keys, tt, hand, S) {
    const N = 5, wa = []; for (let k = 0; k <= N; k++) wa.push(z5Pose(keys, tt - k / 30).wa);
    let m = 0, newest = -1; for (let k = 0; k < N; k++) if (Math.abs(wa[k] - wa[k + 1]) > 0.3) { m = k + 1; if (newest < 0) newest = k; }
    if (!m) return;
    z5Arc(hand[0], hand[1], wa[m], wa[0] - wa[m], 29 * S * 1.03, newest / N * 0.9);
  }
  // the light of a scene on the last stamped sprite: the edge facing (lx, ly) takes c (the outline is left alone), and a
  // one-pixel line of ink cc round the outside keeps the silhouette crisp against glows and bloom
  function z5Rim(lx, ly, c, d, cc) {
    if (SMB[2] < SMB[0]) return;
    const x0 = Math.max(1, SMB[0] - 1), x1 = Math.min(W - 2, SMB[2] + 1), y0 = Math.max(LB, SMB[1] - 1), y1 = Math.min(H - LB - 1, SMB[3] + 1);
    const ox = Math.round(lx * d), oy = Math.round(ly * d);
    if (c !== undefined && c !== null) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (!SMASK[i]) continue;
      const b = BUF[i]; if (b >= 81 && b <= 87) continue;
      const X = x + ox, Y = y + oy;
      if (X < 0 || Y < 0 || X >= W || Y >= H || !SMASK[Y * W + X]) BUF[i] = c;
    }
    if (cc !== undefined) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (SMASK[i]) continue;
      if (SMASK[i - 1] || SMASK[i + 1] || SMASK[i - W] || SMASK[i + W]) BUF[i] = cc;
    }
  }
  // a blade meeting something, g seconds on: a flare across the contact, sparks thrown on along the stroke (dir), void
  // ichor spat back the other way, a ring; power scales it
  function z5Hit(x, y, g, power, dir, col, seed) {
    if (g < 0 || g > 0.55) return;
    const f = g / 0.55, ca = Math.cos(dir), sa = Math.sin(dir);
    if (g < 0.17) {
      const k = 1 - g / 0.17, L1 = 80 * power * k, L2 = 26 * power * k;
      glow(x, y, 46 * power * k + 6, T_WH, 0.55);
      thick(x - ca * L1, y - sa * L1, x + ca * L1, y + sa * L1, k > 0.5 ? 2 : 1, 22);
      lineP(x + sa * L2, y - ca * L2, x - sa * L2, y + ca * L2, 22);
      discF(x, y, 2 + 5 * power * k, 22);
    }
    for (let k = 0; k < 24 * power; k++) {
      const a = dir + (ih(k, 1, seed) - 0.5) * 1.5, v = (80 + ih(k, 2, seed) * 280) * power, dd = v * g * (1 - g * 0.9), px = x + Math.cos(a) * dd, py = y + Math.sin(a) * dd + 140 * g * g;
      if (bay(fl(px), fl(py)) > 1.15 - f) continue;
      const tl = 2 + v * 0.025 * (1 - f);
      lineP(px, py, px - Math.cos(a) * tl, py - Math.sin(a) * tl, k % 3 ? col : 22);
    }
    for (let k = 0; k < 12 * power; k++) {
      const a = dir + PI + (ih(k, 3, seed) - 0.5) * 1.8, v = (40 + ih(k, 4, seed) * 120) * power, px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 200 * g * g, s = 1 + fl(ih(k, 5, seed) * 2.5);
      if (bay(fl(px), fl(py)) > 1 - f) continue;
      rectF(px, py, s, s, k % 4 ? 77 : 74);
    }
    if (g < 0.3) shockRing(x, y, 4 + g * 220 * power, 3 + g * 150 * power, 2, [22, col, col], 1 - g / 0.3);
    shk(4 * power * Math.max(0, 1 - g * 4));
  }
  // the zenith hero driven by a track (faces right): wings that beat and flare with the pose, orbs trailing the body,
  // ghosts on a dash, the prism slash trail, the light of the scene on its edge; base: { S, orbR, auraR, rim: [lx, ly, c] }
  function z5Fight(keys, tt, base) {
    const p = z5Pose(keys, tt), S = p.S || base.S || 2, t = T_NOW, f = fl(t * 30);
    const vib = (p.vib || 0) + FRZ, jx = vib ? Math.round((ih(f, 3, 601) - 0.5) * 2 * vib) : 0, jy = vib ? Math.round((ih(f, 4, 601) - 0.5) * 2 * vib) : 0;
    const idle = 1 - clamp(p.sp / 220, 0, 1), wt = tt * (base.flap || 1.6), fa = p.flap === undefined ? 0.26 : p.flap, bob = z5Bob(wt, S, fa) * idle;
    const OX = base.ox || 0, x = p.x + jx + OX, y = p.y + jy + bob, ang = p.ang;
    // the orbs trail the body (they are where it was a moment ago), so they swing out on every dash and catch up
    const og = z5Trk(keys, tt - 0.09); og.x += OX;
    if (base.orbR) z5Orbs(og.x, og.y, base.orbR, tt, S * 1.2, 0.4, false);
    z5Wings(x - Math.sin(ang) * 6 * S, y - Math.cos(ang) * 6 * S, S * 0.55, wt, p.spread === undefined ? 1 : p.spread, fa);
    const after = [];
    if (p.sp > 280) for (let k = 1; k <= 3; k++) { const a = z5Trk(keys, tt - k * 0.03); after.push([a.x + OX, a.y, k === 1 ? 22 : PRISM[(k * 2 + f) % 7], 0.6 - k * 0.14]); }
    // the feet trail the motion; at rest they paddle
    const lvx = p.svx * Math.cos(ang) + (p.vy || 0) * Math.sin(ang) * 0.3, legSh = clamp(-lvx / (60 * S), -3, 3) + Math.sin(tt * 4.2) * 0.7 * idle;
    const legs = [0, 1, 2, 3].map((k) => Math.max(0, Math.sin(tt * 6.5 + k * 1.6)) * 1.2 * idle + (p.sq > 0.15 ? 1 : 0));
    const res = actor(HEROZ({ eyes: p.eyes || 'glow', mouth: p.mouth, sword: p.sw, swordCols: z5Sw(t), sq: (p.sq || 0) + Math.sin(tt * 3.1) * 0.04 * idle, reach: p.reachT, legs, legSh }), x, y, S, ang, false, { still: true, after, st: p.st, sd: p.sd });
    z5Eyes();
    if (base.rim) z5Rim(base.rim[0], base.rim[1], base.rim[2], Math.max(2, S * 1.4));
    aura(t, ZEN_FLAME, base.auraR || 3 * S, { sparks: 10, rise: base.rise });
    z5Rim(0, 0, null, 0, 63);
    if (base.orbR) z5Orbs(og.x, og.y, base.orbR, tt, S * 1.2, 0.4, true);
    z5Trail(keys, tt, res.hand, S);
    // a cocked blade, held: a glint runs up it to the point (the tell before the stroke)
    if ((p.sq || 0) > 0.24 && Math.abs(p.swv) < 3) { const u = frac(tt * 3.2), gx = lerp(res.hand[0], res.tip[0], u), gy = lerp(res.hand[1], res.tip[1], u); sparkle(gx, gy, 2 + u * 5, 22, 60); if (u > 0.8) glow(res.tip[0], res.tip[1], 22, T_WH, 0.5); }
    // a thrust leaves no arc: streaks run back from the point along the lunge
    if (p.sp > 500 && Math.abs(p.swv) < 6) for (let k = 0; k < 5; k++) { const o = (k - 2) * 3 * S * 0.5, L = p.sp * 0.09, ca = Math.cos(p.sd), sa = Math.sin(p.sd), bx = res.tip[0] - sa * o - ca * 6, by = res.tip[1] + ca * o - sa * 6; lineF(bx, by, bx - ca * L, by - sa * L, (X, Y, u) => { if (bay(X, Y) < 0.9 - u) P(X, Y, k === 2 ? 22 : PRISM[(k + f) % 7]); }); }
    return { x, y, S, hand: res.hand, tip: res.tip, p, sp: p.sp };
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
  function z5Beam(x0, y0, x1, y1, w, colAt, t, seed, wf) {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, L = Math.sqrt(L2) || 1, w0 = w;
    if (wf) w *= 1.8;                                         // (wf(s): a width factor along it, for pulses; bound the box)
    const bx0 = Math.max(0, fl(Math.min(x0, x1) - w * 2)), bx1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + w * 2));
    const by0 = Math.max(0, fl(Math.min(y0, y1) - w * 2)), by1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + w * 2));
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, u = clamp((px * dx + py * dy) / L2, 0, 1), qx = px - u * dx, qy = py - u * dy, d = Math.sqrt(qx * qx + qy * qy);
      const wob = w0 * (wf ? wf(u * L) : 1) * (0.85 + 0.15 * Math.sin(u * L * 0.25 - t * 40 + seed) + 0.08 * Math.sin(u * L * 0.7 + t * 23));
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

  /* -------------------------------------------------------------- motion: springs, knocks, drift (all pure functions of time, so any frame can be seeked) */
  // a knock g seconds after an impact: out fast to amp, back past zero once or twice, settled (0 before the impact)
  function z5Knock(g, amp, w, d) {
    if (g <= 0) return 0;
    w = w || 16; d = d || 6;
    const gp = Math.atan(w / d) / w, n = Math.exp(-d * gp) * Math.sin(w * gp);
    return amp * Math.exp(-d * g) * Math.sin(w * g) / n;
  }
  // the sum of knocks from a list of impact times
  const z5Knocks = (t, hits, amp, w, d) => { let s = 0; for (const h of hits) s += z5Knock(t - h, amp, w, d); return s; };
  // an arrival that overshoots and rings out: 0 → 1 (critically under-damped step; g in seconds, w the ring rate)
  const z5Step = (g, w, d) => (g <= 0 ? 0 : 1 - Math.exp(-(d || 7) * g) * (Math.cos((w || 12) * g) + (d || 7) / (w || 12) * Math.sin((w || 12) * g)));
  // smooth drift noise (-1..1), a few incommensurate sines: for floating cameras, buffeting, moving holds
  const z5N = (t, s) => Math.sin(t * 1.13 + s) * 0.5 + Math.sin(t * 1.97 + s * 2.3) * 0.3 + Math.sin(t * 3.41 + s * 0.7) * 0.2;
  // faster shudder (strain, buffet): still smooth, so life() reads it as tremble rather than teleporting
  const z5Sh = (t, s) => Math.sin(t * 31 + s) * 0.5 + Math.sin(t * 47.3 + s * 1.9) * 0.3 + Math.sin(t * 19.7 + s * 3.1) * 0.2;
  // a quadratic bezier point
  const z5Bz = (a, b, c, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c;
  // a limp body's legs, drifting slowly as if under water
  const z5Limp = (t, amt) => [0, 1, 2, 3].map((k) => clamp(1.2 + Math.sin(t * 0.9 + k * 1.7) * amt, 0, 3));
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

  /* ================================================================ the Sunderer: the Unmaker's brother
     Where his brother erased, he breaks. A mountain of obsidian veined with molten seams, broad porcelain shoulders, four
     arms ending in porcelain gauntlets, a crown of black blades, and a mask of the same porcelain as his brother's: wider,
     heavier in the jaw, split top to bottom by a seam of fire, with two burning slits for eyes and a mouth that tears open.
     Local units like the Unmaker's (s screen px each): the mask is 38 wide and 50 tall about (cx, cy); the shoulders span
     about 200; the body runs on down out of the frame. */
  const OBS = [96, 97, 98, 99, 100], MOLT = [101, 102, 103, 104, 105, 106, 107], BONE4 = [69, 68, 67, 66, 65, 64];
  const T_EMBER = mkTab('ff5020', true), T_BLOOD = mkTab('c01008', true), T_ASH = mkTab('3a3030', false);
  // the four shoulders (local): upper pair, lower pair
  const SH4 = [[-84, 40], [84, 40], [-60, 94], [60, 94]];
  // a filled capsule (a thick segment with round ends, radius r0 at a to r1 at b), each pixel coloured by fn(u, d, x, y)
  // where u runs 0..1 along it and d is the distance from the axis over the radius (0 middle .. 1 rim)
  function capsF(ax, ay, bx, by, r0, r1, fn) {
    const R = Math.max(r0, r1), x0 = Math.max(0, fl(Math.min(ax, bx) - R - 1)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + R + 1));
    const y0 = Math.max(0, fl(Math.min(ay, by) - R - 1)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + R + 1));
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, u = clamp((px * dx + py * dy) / L2, 0, 1), qx = px - dx * u, qy = py - dy * u, r = lerp(r0, r1, u), d2 = qx * qx + qy * qy;
      if (d2 > r * r) continue;
      const c = fn(u, Math.sqrt(d2) / r, x, y, qx / r, qy / r); if (c >= 0) BUF[y * W + x] = c;
    }
  }
  /* a limb: a tube from a to b whose radius follows rfn(u); shaded as a lit cylinder (light from the upper left), glossy
     where it faces the light, rim-lit by the fire on its far side; fn(u, side, lit, X, Y) may override the colour */
  function limbF(ax, ay, bx, by, rfn, rmax, fn) {
    const x0 = Math.max(0, fl(Math.min(ax, bx) - rmax - 1)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + rmax + 1));
    const y0 = Math.max(0, fl(Math.min(ay, by) - rmax - 1)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + rmax + 1));
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, L = Math.sqrt(L2), nx0 = -dy / L, ny0 = dx / L;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, uu = (px * dx + py * dy) / L2, u = clamp(uu, 0, 1), qx = px - dx * u, qy = py - dy * u, r = rfn(u);
      const d2 = qx * qx + qy * qy; if (d2 > r * r) continue;
      const sdn = (qx * nx0 + qy * ny0) / r, cap = uu < 0 || uu > 1;                   // -1 .. 1 across the tube
      // the surface normal of a cylinder seen side-on, tilted at the round ends
      const nX = nx0 * sdn + (cap ? (uu < 0 ? -dx : dx) / L * 0.6 : 0), nY = ny0 * sdn + (cap ? (uu < 0 ? -dy : dy) / L * 0.6 : 0), nz = Math.sqrt(Math.max(0, 1 - sdn * sdn));
      const lit = -nX * 0.55 - nY * 0.7 + nz * 0.45;
      const c = fn(u, sdn, lit, x, y, Math.sqrt(d2) / r); if (c >= 0) BUF[y * W + x] = c;
    }
  }
  const obsLit = (lit, X, Y, e, heat) => e > 0.9 ? 96 : (lit < -0.55 && e > 0.62 && heat > 0.2) ? 102 : lit > 0.78 ? (e < 0.5 ? 122 : 100) : OBS[clamp(fl(1.6 + lit * 2.6 + (bay(X, Y) - 0.5) * 0.8), 0, 4)];
  // porcelain, lit from the upper left: (nx, ny) the surface's lean (-1..1)
  const bone = (nx, ny, x, y, k) => BONE4[clamp(fl(3 + (-nx * 0.9 - ny * 0.8) * 1.6 + (bay(x, y) - 0.5) * 0.9 + (k || 0)), 0, 5)];
  /* a hand of porcelain plates: wrist at (x, y), pointing along angle a, scale s.
     h: { curl 0 (open) .. 1 (fist), or curls [index, middle, ring, little], thumb 0..1 (tucked across), spread 0..1 (fanned),
          side ±1 (which side the thumb is on), heat (fire in the joints), layer 'palm' | 'fingers' | undefined (both),
          hold(info): drawn between the palm and the fingers (whatever the hand is holding) }.
     The fingers bend toward the viewer as they curl: each joint folds, the segment foreshortens (cos of its bend) and past a
     right angle it lies back over the palm — so open hand, claw, grip and fist are one continuous motion.
     Returns [x, y] of the striking point (the knuckles of a fist, the fingertips of an open hand) with .palm, .tip, .knuckles. */
  const H_FL = [0.95, 1.05, 1.0, 0.82], H_FR = [1, 1.05, 1, 0.88], H_SEG = [8.2, 6.0, 4.4], H_SR = [2.7, 2.4, 2.1], H_FLEX = [1.0, 1.4, 1.05];
  function sHand(x, y, s, a, h, t) {
    h = h || {};
    const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux, sd = h.side || 1, heat = h.heat || 0;
    const L = (al, ac) => [x + ux * al * s + vx * ac * s, y + uy * al * s + vy * ac * s];
    const curls = h.curls || [0, 1, 2, 3].map((k) => clamp((h.curl || 0) * (1.06 - k * 0.02), 0, 1));
    const spread = h.spread === undefined ? 0.3 : h.spread, th = h.thumb === undefined ? (h.curl || 0) * 0.9 : h.thumb;
    const outl = Math.max(1, 1.3 * Math.min(1, s / 1.4));
    // the geometry, in hand space: palm capsules, finger chains, thumb
    const palm = [[1, 0, 9.5, 0, 8.6, 8.2], [2, -5.6, 10.4, -5.4, 4.6, 4.2], [2, 5.6, 10.4, 5.4, 4.6, 4.2]];
    const fingers = [];
    let front = -1e9, frontP = null, tipP = null;
    for (let k = 0; k < 4; k++) {
      const v0 = sd * (6.3 - 4.2 * k), fan = spread * (k - 1.5) * -sd * 0.17, c = curls[k];
      let px = 10.8, py = v0, phi = 0;
      const segs = [];
      for (let j = 0; j < 3; j++) {
        phi += c * H_FLEX[j] * 1.25;
        const len = H_SEG[j] * H_FL[k], pr = Math.cos(Math.min(phi, PI)), dx = Math.cos(fan) * len * pr, dy = Math.sin(fan) * len * Math.abs(pr) + (phi > PI / 2 ? -sd * 0 : 0);
        // past a right angle the segment comes back over the palm, drifting toward its middle
        const qx = px + dx, qy = py + dy + (phi > 1.2 ? -v0 * 0.05 * (phi - 1.2) : 0);
        segs.push([px, py, qx, qy, H_SR[j] * H_FR[k], phi]);
        if (j === 0 && qx > front) { front = qx; frontP = [qx, qy]; }
        px = qx; py = qy;
      }
      if (k === 0) tipP = [px, py];
      if (px > front) { front = px; frontP = [px, py]; }
      fingers.push({ segs, c });
    }
    const tb = [2.6, sd * 7.6], topen = [2.6 + 6.5 * Math.cos(1.0), sd * (7.6 + 6.5 * Math.sin(1.0))], tcurl = [11.4, sd * 0.6];
    const tmid = [lerp((tb[0] + topen[0]) / 2, 8.2, th), lerp((tb[1] + topen[1]) / 2, sd * 6.4, th)], ttip = [lerp(topen[0], tcurl[0], th), lerp(topen[1], tcurl[1], th)];
    const thumb = [[tb[0], tb[1], tmid[0], tmid[1], 3.1, 2.8], [tmid[0], tmid[1], ttip[0], ttip[1], 2.8, 2.3]];
    // drawing helpers
    const capL = (q, pad, fn) => { const [ax, ay] = L(q[0], q[1]), [bx, by] = L(q[2], q[3]); capsF(ax, ay, bx, by, q[4] * s + pad, q[5] * s + pad, fn); };
    const shade = (k0) => (u, d, X, Y, nx, ny) => d > 0.84 ? 69 : bone(nx, ny, X, Y, k0);
    const doPalm = h.layer !== 'fingers', doFing = h.layer !== 'palm';
    if (doPalm) {
      for (const q of palm) capL(q, outl, () => 96);
      for (const q of palm) capL(q, 0, shade(-0.2));
      // the plates of the back of the hand, and the knuckle ridge
      for (let k = 0; k < 3; k++) { const [ax, ay] = L(2.5 + k * 0.3, sd * (4.2 - 4.2 * k) * 0.9), [bx, by] = L(9.6, sd * (4.2 - 4.2 * k)); lineP(ax, ay, bx, by, k === 1 ? 67 : 68); }
      for (let k = 0; k < 4; k++) { const [kx, ky] = L(10.6, sd * (6.3 - 4.2 * k)); discF(kx, ky, Math.max(1, 2.2 * s), curls[k] > 0.45 ? 64 : 66); }
      if (heat > 0.25) { const [ax, ay] = L(0.4, -7), [bx, by] = L(0.4, 7); lineP(ax, ay, bx, by, heat > 0.6 ? 105 : 103); }
    }
    if (h.hold) h.hold({ palm: L(5.5, 0), front: L(frontP[0], frontP[1]), ux, uy, s });
    if (doFing) {
      // fingers: the ones folded furthest are drawn last (they lie nearest the viewer)
      const order = [0, 1, 2, 3].sort((p_, q_) => fingers[p_].c - fingers[q_].c);
      const drawThumb = () => { for (const q of thumb) capL(q, outl, () => 96); for (const q of thumb) capL(q, 0, shade(0)); };
      if (th < 0.5) drawThumb();
      for (const k of order) {
        const F = fingers[k];
        for (const q of F.segs) capL(q, outl, () => 96);
        F.segs.forEach((q, j) => {
          const facing = Math.sin(Math.min(q[5], PI));               // a segment turned toward us catches more light
          capL(q, 0, shade(0.15 + facing * 0.55 - j * 0.12 - (q[5] > PI * 0.6 ? 0 : 0.2)));
          const [jx, jy] = L(q[0], q[1]);
          if (j > 0) { if (heat > 0.3) P(jx, jy, heat > 0.65 ? 105 : 103); else P(jx, jy, 68); }
        });
        // a claw on the last segment while it still points outward
        const q = F.segs[2], ph = q[5];
        if (Math.cos(ph) > 0.25) { const [ex, ey] = L(q[2], q[3]), [bx, by] = L(q[0], q[1]), aa = Math.atan2(ey - by, ex - bx); z5Kite(ex - Math.cos(aa) * s, ey - Math.sin(aa) * s, aa, 3.2 * s, 1.1 * s, 97); }
      }
      if (th >= 0.5) drawThumb();
    }
    const out = L(frontP[0], frontP[1]);
    out.palm = L(5.5, 0); out.tip = L(tipP[0], tipP[1]); out.knuckles = L(10.8, 0);
    return out;
  }
  // the old poses, now presets of the hand (pose may also be a hand object)
  const POSES = {
    fist: { curl: 1, thumb: 0.95, spread: 0 }, open: { curl: 0.06, thumb: 0.05, spread: 1 }, chop: { curl: 0, thumb: 0.75, spread: 0 },
    grab: { curl: 0.62, thumb: 0.55, spread: 0.45 }, claw: { curl: 0.42, thumb: 0.25, spread: 0.85 }, pinch: { curls: [0.42, 0.95, 0.98, 1], thumb: 0.62, spread: 0 },
    point: { curls: [0, 1, 1, 1], thumb: 0.9, spread: 0 },
  };
  const poseOf = (p) => (typeof p === 'object' && p ? p : POSES[p] || POSES.fist);
  function sGauntlet(x, y, s, a, pose, heat, t, extra) {
    const h = Object.assign({}, poseOf(pose), { heat: heat || 0 }, extra || {});
    return sHand(x, y, s, a, h, t);
  }
  // cellular seams over the obsidian (f2 - f1 small = on a seam); cheap enough per pixel
  function seamAt(px, py) {
    const ix = fl(px), iy = fl(py); let f1 = 9, f2 = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const gx = ix + i, gy = iy + j, cx = gx + ih(gx, gy, 971), cy = gy + ih(gx, gy, 972), d = (px - cx) * (px - cx) + (py - cy) * (py - cy); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; }
    return Math.sqrt(f2) - Math.sqrt(f1);
  }
  // the shape of the body (local): a neck, shoulders like a ridge, a chest that runs down out of the frame like a mountain
  function sHW(ly) {
    if (ly < 16) return -1;
    if (ly < 30) return 17 + (ly - 16) * 0.5;
    if (ly < 46) return lerp(24, 108, Math.sqrt((ly - 30) / 16));
    if (ly < 150) return lerp(108, 66, Math.pow((ly - 46) / 104, 0.9));
    return lerp(66, 110, clamp((ly - 150) / 220, 0, 1));
  }
  function sBodyIn(lx, ly) {
    const hw = sHW(ly); if (hw < 0) return false;
    const ax = Math.abs(lx);
    if (ly < 46 && ax > 26) { const top = 30 + Math.pow(Math.max(0, ax - 26) / 82, 1.6) * 16; if (ly < top) return false; }
    return ax < hw + (vn(ly * 0.08, lx > 0 ? 1 : 0, 1, 973) - 0.5) * 8;
  }
  // the light on the body's planes: k (darker < 0 < lighter) and whether this is a groove between plates
  function sPlanes(lx, ly) {
    const ax = Math.abs(lx);
    // pectorals: two broad plates, lit along their tops, a groove under them and down the sternum
    const pu = (ax - 36) / 38, pv = (ly - 64) / 24, pr = pu * pu + pv * pv;
    if (ax < 2.2 && ly > 48 && ly < 92) return [-1.2, true];
    if (pr < 1) return [0.4 - pv * 1.1 - pu * 0.3, pr > 0.86 && pv > 0];
    // the plates of the stomach, three rows
    if (ly > 90 && ly < 150 && ax < 44) { const row = (ly - 90) / 20, f = frac(row); return [0.25 - Math.abs(f - 0.5) * 0.9 - ax / 90, false]; }
    // the flanks fall into shadow
    return [-0.6 - (ax - 40) / 90, false];
  }
  // the crown: black blades fanned behind the head
  function sCrown(cx, cy, s, t, amt, spin) {
    if (amt <= 0) return;
    for (let k = 0; k < 13; k++) {
      if (ih(k, 1, 981) > amt * 1.15) continue;
      const a = -PI + (k + 0.5) / 13 * PI + Math.sin(t * 0.6 + k) * 0.02 + (spin || 0), r0 = 26 * s, r1 = (52 + ih(k, 2, 981) * 22 - Math.abs(k - 6) * 2) * s * Math.min(1, amt * 1.3), w = (3.4 + ih(k, 3, 981) * 1.6) * s;
      const ux = Math.cos(a), uy = Math.sin(a), bx = cx + ux * r0, by = cy - 8 * s + uy * r0 * 0.9, tx = cx + ux * r1, ty = cy - 8 * s + uy * r1 * 0.9;
      const mx = lerp(bx, tx, 0.3), my = lerp(by, ty, 0.3);
      for (const [ww, c] of [[w + 1.4, 101], [w, 96]]) { z5Tri(bx, by, mx - uy * ww, my + ux * ww, tx, ty, c); z5Tri(bx, by, mx + uy * ww, my - ux * ww, tx, ty, c); }
      lineP(bx + (-uy) * w * 0.5, by + ux * w * 0.5, tx, ty, 103);
      P(tx, ty, 105); P(tx - ux, ty - uy, 104);
    }
  }
  // the mask; (mx, my) local, already turned into the mask's own frame
  // the mask's half-width at height v (-1 top .. 1 chin): a narrow crown, wide cheekbones, a heavy square jaw
  function mHW(v) {
    if (v < -0.55) { const q = (v + 0.55) / 0.45; return 0.86 * Math.sqrt(Math.max(0, 1 - q * q)); }
    if (v < 0.08) return lerp(0.86, 1.02, (v + 0.55) / 0.63);
    if (v < 0.78) return lerp(1.02, 0.8, (v - 0.08) / 0.7);
    const q = (v - 0.78) / 0.22; return 0.8 * Math.pow(Math.max(0, 1 - q * q * q * q), 0.25);
  }
  function sMaskPx(mx, my, x, y, t, o) {
    const u = mx / 19, v = my / 25, au = Math.abs(u);
    if (v < -1 || v > 1) return -1;
    const hw = mHW(v); if (au >= hw) return -1;
    const edge = au > hw - 0.07 || v < -0.97 || v > 0.97;
    // the sculpting: a V brow (low in the middle), the sockets sunk under it, a nose ridge, cheekbones, hollows, the jaw
    const browY = -0.1 - au * 0.2, sm = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
    const sock = sm(browY, browY + 0.05, v) * sm(browY + 0.32 - au * 0.12, browY + 0.22 - au * 0.12, v) * sm(0.08, 0.16, au) * sm(0.84, 0.72, au), inSock = sock > 0.5;
    const nose = sm(0.1, 0.05, au) * sm(browY, browY + 0.06, v) * sm(0.4, 0.3, v);
    const cheek = sm(0.08, 0.18, v) * sm(0.34, 0.24, v) * sm(0.38, 0.5, au) * sm(0.95, 0.85, au);
    const hollow = sm(0.3, 0.38, v) * sm(0.54, 0.46, v) * sm(0.42, 0.55, au) * sm(0.92, 0.8, au);
    const brow = sm(browY - 0.1, browY - 0.04, v) * sm(browY + 0.01, browY - 0.01, v) * sm(0.02, 0.1, au);
    let nx = u * 0.9, ny = v * 0.6 - 0.15;
    let k = brow * 1.3 - sock * (3.2 - (v - browY) * 3) + nose * (u > 0.03 ? -0.6 : 1.0) + cheek * (0.9 - (au - 0.4) * 1.4) - hollow * 1.5 - (v > 0.84 ? 0.8 : 0);
    let c = edge ? 69 : bone(nx, ny, x, y, k);
    if (inSock && (v - browY) < 0.05) c = 96;
    // the eyes: burning slits slanted into a glare, sunk in shadow under the heavy brow
    const eo = o.eyes === undefined ? 1 : o.eyes;
    for (const sd of [-1, 1]) {
      const ex = mx - sd * 8.2, ey = my + 1.2, rot = sd * 0.36, rx = ex * Math.cos(rot) + ey * Math.sin(rot), ry = -ex * Math.sin(rot) + ey * Math.cos(rot);
      const hh = (0.25 + Math.min(1, eo) * 1.0) * (1 - Math.pow(Math.abs(rx) / 6.2, 2));
      if (eo > 0.02 && Math.abs(rx) < 6.2 && Math.abs(ry) < hh) c = Math.abs(ry) < hh * 0.45 ? (eo > 1.3 ? 22 : 107) : eo > 1 ? 105 : 103;
    }
    // the seam of fire, top to bottom (wider with rage), and its branches
    const sj = (vn(my * 0.35, 0, 1, 991) - 0.5) * 2.4 + Math.sin(my * 0.4) * 0.7, dsx = Math.abs(mx - sj), sw = 0.55 + (o.rage || 0) * 1.3;
    if (dsx < sw + 0.7) c = dsx < sw * 0.5 ? 107 : dsx < sw ? 105 : 103;
    for (const [by0, dir, len] of [[-12, -1, 7], [6, 1, 6], [16, -1, 5]]) { const along = (my - by0) * 0.0 + (mx - sj) * dir; if (along > 0 && along < len && Math.abs(my - by0 - along * 0.55) < 0.5 + 0.3 * (o.rage || 0)) c = 104; }
    // the mouth: a jagged crack across the jaw; roar tears it open on molten dark and porcelain teeth
    const ry0 = 15.5 + (vn(mx * 0.5, 3, 1, 992) - 0.5) * 1.6 + Math.abs(mx) * 0.06, roar = o.roar || 0, mw = 12.5 + roar * 2;
    if (Math.abs(mx) < mw) {
      const h = roar * 10 * (1 - Math.pow(Math.abs(mx) / mw, 2.2));
      if (my > ry0 - 0.55 && my < ry0 + 0.55 + h) {
        if (h > 1.2 && my > ry0 + 0.5 && my < ry0 + h - 0.5) {
          const tw = Math.abs(frac(mx / 2.6) - 0.5) * 2, top = my - ry0, bot = ry0 + h - my;
          c = tw < 1 - top / 2.4 || tw < 1 - bot / 2.4 ? bone(0, -0.3, x, y, 1) : (my - ry0) / h < 0.5 ? 101 : bay(x, y) < 0.5 ? 102 : 103;
        } else c = 96;
      }
    }
    // the third eye: his brother's, taken into his brow — a slit of void with a spiral turning in it
    if (o.third > 0) {
      const dx = mx, dy = my + 16.5, inn = (dx * dx) / (3.4 * o.third) ** 2 + (dy * dy) / (6.4 ** 2);
      if (inn < 1) { const r = Math.sqrt(dx * dx + dy * dy), f = frac(Math.atan2(dy, dx) / TAU * 3 - r * 0.5 + t * 1.3); c = inn > 0.75 ? 73 : r < 1.2 ? 22 : f < 0.45 ? 76 : f < 0.7 ? 72 : 75; }
      else if (inn < 1.4) c = 77;
    }
    // cuts in the mask (the hero's): glowing lines
    for (const C of o.maskCuts || []) { const [ax, ay, bx, by, amt] = C, ddx = bx - ax, ddy = by - ay, L2 = ddx * ddx + ddy * ddy, q = clamp(((mx - ax) * ddx + (my - ay) * ddy) / L2, 0, amt), qx = ax + ddx * q, qy = ay + ddy * q, d = Math.hypot(mx - qx, my - qy); if (d < 1.4) c = d < 0.6 ? 22 : 105; else if (d < 2.1) c = 96; }
    return c;
  }
  /* sunderer(cx, cy, s, t, o): the whole of him, mask centred at (cx, cy). o:
       eyes 0..2, rage 0..1 (the seams widen), roar 0..1, third 0..1 (his brother's eye in his brow), heat 0..1 (how hot the
       seams burn), crown 0..1, glow, tilt, nod, still, shake,
       arms: up to four { x, y (the wrist, local), pose, front (drawn over the mask), cut (severed at the elbow), heat, fs (fist size) }, in
         the order upper-left, upper-right, lower-left, lower-right; null leaves an arm out,
       wounds: [[x0, y0, x1, y1, width]] glowing cuts in the body (local); maskCuts: [[x0, y0, x1, y1, amt]] (mask frame),
       split: 0..1 the final cut: he comes apart along splitA (angle) through (splitX, splitY) local, the halves sliding apart,
       dark: 0..1 silhouette (only the fire shows), body: false to skip the body, core 0..1 the molten heart in the chest.
     Returns { hands: screen points of the four fists, eyes: [[x, y], [x, y]], core: [x, y], brow: [x, y] }. */
  /* his body has physics too (like the hero's life()): per draw, per arm, a little state — the elbow trails the hand, the
     shoulder heaves toward a reach, the whole upper body leans into a blow and rocks back, the hand turns a beat after the
     forearm and shudders when a blow stops dead, the fingers close and open over a few frames instead of snapping */
  const SLIFE = { n: 0, s: [] };
  function sSpring(o, key, target, k, z, dt) { let x = o[key], v = o[key + 'v'] || 0; const c = 2 * z * Math.sqrt(k), n = Math.ceil(dt * 240), h = dt / n; for (let i = 0; i < n; i++) { v += (k * (target - x) - c * v) * h; x += v * h; } o[key] = x; o[key + 'v'] = v; return x; }
  function sLifeOf(s, still) {
    const slot = SLIFE.n++, dt = LIFE.dt;
    let st = SLIFE.s[slot];
    if (!st || dt < 0 || still) st = SLIFE.s[slot] = { lean: 0, leanv: 0, arms: [0, 1, 2, 3].map(() => null), fresh: true };
    st.dt = dt; return st;
  }
  function sunderer(cx, cy, s, t, o) {
    o = o || {};
    const ST = sLifeOf(s, o.still), dt = ST.dt;
    // the lean: the upper body pushed by the arms' motion (local units), springing back
    let push = 0;
    (o.arms || []).forEach((A, k) => { const a = ST.arms[k]; if (A && a && !a.fresh && dt > 0) push += (a.vx || 0) * 0.0045 + (a.vy || 0) * 0.0015 * (k % 2 ? 1 : -1); });
    const leanT = clamp(push, -16, 16) + (o.lean || 0);
    const lean = dt > 0 ? sSpring(ST, 'lean', leanT, 70, 0.55, dt) : ST.lean;
    const live = o.still ? 0 : 1;
    cy += Math.sin(t * 0.9) * 1.0 * s * live;
    const sh = o.shake ? z5Sh(t, 7) * o.shake : 0, heat = o.heat === undefined ? 0.5 : o.heat, dark = o.dark || 0;
    const mcx = cx + (Math.sin(t * 0.6) * 0.6 * s) * live + sh + lean * s * 0.95, mcy = cy + (Math.sin(t * 0.9 - 0.8) * 0.5 * s + (o.nod || 0) * s) * live;
    const tilt = (Math.sin(t * 0.47) * 0.035) * live + (o.tilt || 0), cT = Math.cos(tilt), sT = Math.sin(tilt);
    // the split: which side of the cut a local point is on, and how far that side has slid
    const spl = o.split || 0, sa = o.splitA === undefined ? 1.2 : o.splitA, sux = Math.cos(sa), suy = Math.sin(sa), spx = o.splitX || 0, spy = o.splitY || 0;
    const side = (lx, ly) => ((lx - spx) * -suy + (ly - spy) * sux) > 0 ? 1 : -1;
    const slide = (sd) => [-suy * sd * spl * 40 + sux * sd * spl * 10, sux * sd * spl * 40 + suy * sd * spl * 10 + spl * spl * 30];
    // local → screen (with the split applied)
    const LS = (lx, ly) => { let X = lx, Y = ly; if (spl > 0) { const [ox, oy] = slide(side(lx, ly)); X += ox; Y += oy; } return [cx + X * s + sh, cy + Y * s]; };
    // screen → local, finding which side's pixels land here
    const SL = (x, y) => {
      let lx = (x + 0.5 - cx - sh) / s, ly = (y + 0.5 - cy) / s;
      if (spl > 0) { for (const sd of [1, -1]) { const [ox, oy] = slide(sd), qx = lx - ox, qy = ly - oy; if (side(qx, qy) === sd) return [qx, qy, sd]; } return null; }
      return [lx, ly, 0];
    };
    const out = { hands: [], eyes: [], core: LS(lean * 0.75, 70), brow: [mcx, mcy - 16 * s], lean };
    // the crown, behind everything
    if (o.crown !== 0) sCrown(mcx, mcy, s, t, o.crown === undefined ? 1 : o.crown, o.crownSpin);
    const glowA = o.glow === undefined ? 0.35 : o.glow;
    glow(cx, cy + 40 * s, 140 * s, T_EMBER, 0.12 * heat * glowA * 2 * (1 - dark));
    // the body
    if (o.body !== false) {
      const x0 = Math.max(0, fl(cx - 112 * s - 60)), x1 = Math.min(W - 1, Math.ceil(cx + 112 * s + 60)), y0 = Math.max(0, fl(cy + 14 * s - 40)), y1 = H - 1;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const q = SL(x, y); if (!q) continue; const ly = q[1], lx = q[0] - lean * Math.max(0, 1 - (ly - 16) / 220);
        if (!sBodyIn(lx, ly)) continue;
        const rim = !sBodyIn(lx + 2.2, ly) || !sBodyIn(lx - 2.2, ly) || !sBodyIn(lx, ly - 2.2);
        if (rim) { BUF[y * W + x] = heat > 0.2 ? (lx < 0 ? 102 : 101) : 98; continue; }
        // the stone has relief: a height field (the planes of muscle, then rock grain) lit from the upper left, glossy where
        // it faces the light; fire collects in the grooves and in veins that branch out from the heart
        const [pk, groove] = sPlanes(lx, ly);
        const hg = (X, Y) => sPlanes(X, Y)[0] * 3.0 + vn(X, Y, 9, 1201) * 2.4 + vn(X, Y, 3.2, 1202) * 0.8;
        const gx = hg(lx + 0.8, ly) - hg(lx - 0.8, ly), gy = hg(lx, ly + 0.8) - hg(lx, ly - 0.8);
        const lit = 0.42 - lx / 320 + pk * 0.25 + (-gx * 0.55 - gy * 0.8) * 0.42;
        let c = lit > 0.86 ? (bay(x, y) < 0.5 ? 122 : 100) : OBS[clamp(fl(lit * 3.4 + (bay(x, y) - 0.5) * 0.8), 0, 4)];
        const dh = Math.hypot(lx, (ly - 70) * 1.2), vh = Math.min(1, heat * 1.3 * Math.max(0, 1 - dh / 125));
        if (groove) c = vh > 0.62 ? (vh > 0.8 ? 104 : 103) : vh > 0.4 ? 101 : 96;
        else { const sd_ = seamAt(lx / 30 + 3, ly / 28), wv = vh > 0.25 ? 0.006 + (vh - 0.25) * (vh - 0.25) * 0.16 : 0.004; if (sd_ < wv) c = sd_ < wv * 0.4 && vh > 0.3 ? (vh > 0.55 ? (pulse > 0.5 ? 106 : 105) : 104) : vh > 0.15 ? 103 : 101; }
        // the fire's light on the stone round the heart
        if (c < 101 && vh > 0.35 && bay(x, y) < (vh - 0.35) * 0.9) c = c === 96 ? 101 : 102;
        // porcelain plates over the shoulders: two layers, with a fin of black blade rising from each
        for (const sd of [-1, 1]) { const px = (lx - sd * 84) / 36, py = (ly - 40) / 22, pr2 = px * px + py * py; if (pr2 < 1 && ly < 56) { c = pr2 > 0.84 ? 69 : bone(px * 0.9, py - 0.5, x, y, -0.2); if (Math.abs(py - 0.15 - px * px * 0.3) < 0.08) c = 96; if (Math.abs(py + 0.35 - px * px * 0.25) < 0.05) c = 68; } }
        // the molten heart
        const hx = lx, hy = ly - 70, hr = Math.sqrt(hx * hx + hy * hy), core = o.core === undefined ? 1 : o.core;
        if (core > 0 && hr < 15) c = hr < 13 ? (hr < 6 * core ? (hr < 3 * core ? 22 : 107) : hr < 10 ? (Math.abs(Math.sin(Math.atan2(hy, hx) * 4 + t)) < 0.25 ? 105 : 103) : 102) : 96;
        for (const W_ of o.wounds || []) { const [ax0, ay0, ax1, ay1, ww] = W_, ddx = ax1 - ax0, ddy = ay1 - ay0, L2 = ddx * ddx + ddy * ddy || 1, u = clamp(((lx - ax0) * ddx + (ly - ay0) * ddy) / L2, 0, 1), d = Math.hypot(lx - ax0 - ddx * u, ly - ay0 - ddy * u); if (d < (ww || 3)) c = d < (ww || 3) * 0.45 ? 22 : 105; else if (d < (ww || 3) + 1.5) c = 101; }
        if (dark > 0 && c !== 22 && c < 103 && bay(x, y) < dark) c = 96;
        BUF[y * W + x] = c;
      }
      if (heat > 0) glow(out.core[0], out.core[1], 40 * s, T_EMBER, 0.35 * heat * (o.core === undefined ? 1 : o.core));
    }
    // the arms (behind the mask unless 'front')
    const drawArm = (k, A) => {
      if (!A) return;
      const sd = SH4[k][0] < 0 ? -1 : 1, up = k < 2, AS = ST.arms[k] || (ST.arms[k] = { fresh: true });
      // the wrist where the shot wants it (exact: contacts land on their frames)
      const [wx, wy] = LS(A.x, A.y);
      // its motion, measured frame to frame
      if (!AS.fresh && dt > 0) { const ivx = (wx - AS.px) / dt, ivy = (wy - AS.py) / dt; AS.pvx = AS.vx || 0; AS.pvy = AS.vy || 0; AS.vx = lerp(AS.pvx, ivx, 0.6); AS.vy = lerp(AS.pvy, ivy, 0.6); }
      else if (AS.fresh) { AS.vx = 0; AS.vy = 0; AS.pvx = 0; AS.pvy = 0; AS.ex = 0; AS.ey = 0; AS.hx = 0; AS.hy = 0; AS.ha = null; AS.shud = 0; }
      const sp = Math.hypot(AS.vx, AS.vy), psp = Math.hypot(AS.pvx || 0, AS.pvy || 0);
      // a blow that stops dead: the hand shudders
      if (dt > 0 && psp > 520 && sp < psp * 0.35) AS.shud = 1;
      AS.shud = (AS.shud || 0) * (dt > 0 ? Math.exp(-dt * 9) : 1);
      // the shoulder heaves toward the reach (local units)
      const rlx = A.x - SH4[k][0], rly = A.y - SH4[k][1], rl = Math.hypot(rlx, rly) || 1, ext = clamp(rl / 170, 0, 1.2);
      const hxT = rlx / rl * 8 * ext + (A.y < SH4[k][1] - 40 ? 0 : 0), hyT = rly / rl * 6 * ext - (A.y < SH4[k][1] - 30 ? 5 : 0);
      if (dt > 0) { sSpring(AS, 'hx', hxT, 140, 0.5, dt); sSpring(AS, 'hy', hyT, 140, 0.5, dt); } else if (AS.fresh) { AS.hx = hxT; AS.hy = hyT; }
      const [ax, ay] = LS(SH4[k][0] + AS.hx + lean * (up ? 0.85 : 0.6), SH4[k][1] + AS.hy);
      // the elbow: bowed outward and down, and trailing the hand's motion
      const mx = (ax + wx) / 2, my = (ay + wy) / 2, dx = wx - ax, dy = wy - ay, L = Math.hypot(dx, dy) || 1, bend = Math.max(0, 152 * s - L) * 0.45;
      if (dt > 0) { sSpring(AS, 'ex', clamp(-AS.vx * 0.03, -24 * s, 24 * s), 160, 0.42, dt); sSpring(AS, 'ey', clamp(-AS.vy * 0.03, -24 * s, 24 * s) + 3 * s, 160, 0.42, dt); }
      const ex = mx + (-dy / L) * bend * -sd * (up ? 1 : 0.8) + (AS.ex || 0), ey = my + (dx / L) * bend * -sd * (up ? 1 : 0.8) + bend * 0.3 + (AS.ey || 0);
      const aHeat = A.heat === undefined ? heat : A.heat;
      // the shoulder joint: a ball of black stone ringed with fire
      discF(ax, ay, 15 * s, 96); limbF(ax - 2, ay - 2, ax + 2, ay + 2, () => 13.5 * s, 14 * s, (u, sdn, lit, X, Y, e) => e > 0.86 ? (aHeat > 0.3 ? 102 : 96) : obsLit(lit, X, Y, e, aHeat));
      // the upper arm: a muscle that swells in the middle and tapers to the elbow
      const rU = (u) => s * (17 + 5 * Math.sin(PI * Math.min(1, u * 1.25)) - u * 4);
      limbF(ax, ay, ex, ey, rU, 22 * s, (u, sdn, lit, X, Y, e) => { const vein = Math.abs(sdn - 0.35 * Math.sin(u * 9 + k)) < 0.06 && u > 0.12 && u < 0.86; return vein && aHeat > 0.25 ? (aHeat > 0.6 ? 104 : 103) : obsLit(lit, X, Y, e, aHeat); });
      if (A.cut) {
        // severed at the elbow: a stump that burns and drips
        discF(ex, ey, 12 * s, 101); discF(ex, ey, 10 * s, 103); discF(ex, ey, 7 * s, 105); discF(ex, ey, 3.5 * s, 22);
        for (let q = 0; q < 5; q++) { const g = frac(t * 0.9 + ih(k, q, 995)), dx2 = (ih(k, q, 996) - 0.5) * 12 * s; rectF(ex + dx2, ey + 6 * s + g * 70 * s, Math.max(1, s * 1.5), Math.max(2, s * 3), g < 0.5 ? 105 : 103); }
        glow(ex, ey, 30 * s, T_EMBER, 0.6);
        out.hands[k] = [ex, ey]; return;
      }
      // the forearm: black stone under a porcelain vambrace of three plates, fire showing in the gaps
      const rF = (u) => s * (12.5 + u * 2.5);
      limbF(ex, ey, wx, wy, rF, 16 * s, (u, sdn, lit, X, Y, e) => {
        if (u < 0.28) return obsLit(lit, X, Y, e, aHeat);
        const pf = (u - 0.28) / 0.72 * 3, gap = frac(pf) < 0.07 && u < 0.98;
        if (gap) return aHeat > 0.25 ? (aHeat > 0.6 ? 104 : 102) : 96;
        if (e > 0.9) return 69;
        if (Math.abs(sdn + 0.15) < 0.05 && frac(pf) > 0.25 && frac(pf) < 0.8) return 67;              // an engraved line
        return BONE4[clamp(fl(2.6 + lit * 2.4 + (bay(X, Y) - 0.5) * 0.9 - (frac(pf) < 0.18 ? 0.8 : 0)), 0, 5)];
      });
      // the elbow cop: a porcelain plate over the joint, fire round its edge
      discF(ex, ey, 11 * s, aHeat > 0.3 ? 102 : 96); limbF(ex - 1, ey - 1, ex + 1, ey + 1, () => 9.5 * s, 10 * s, (u, sdn, lit, X, Y, e) => e > 0.86 ? 69 : BONE4[clamp(fl(2.4 + lit * 2.4 + (bay(X, Y) - 0.5) * 0.9), 0, 5)]);
      discF(wx, wy, 13 * s, aHeat > 0.3 ? 103 : 96);
      // the hand: it turns a beat after the forearm (and shudders when a blow stops)
      const fa = Math.atan2(wy - ey, wx - ex), aT = A.ang === undefined ? fa : A.ang;
      if (AS.ha === null || AS.ha === undefined || AS.fresh) { AS.ha = aT; AS.hav = 0; }
      else if (dt > 0) { let tg = aT; while (tg - AS.ha > PI) tg -= TAU; while (tg - AS.ha < -PI) tg += TAU; sSpring(AS, 'ha', tg, 420, 0.45, dt); }
      const shk_ = AS.shud * 0.18 * Math.sin(t * 70);
      // the fingers close and open over a few frames
      const P_ = poseOf(A.pose || 'fist'), tc = P_.curls || [0, 1, 2, 3].map(() => P_.curl);
      if (!AS.c || AS.fresh) { AS.c = tc.map((c) => ({ v: c, vv: 0 })); AS.th = { v: P_.thumb, vv: 0 }; AS.spd = { v: P_.spread, vv: 0 }; }
      else if (dt > 0) { AS.c.forEach((c, i) => sSpring(c, 'v', tc[i], 520, 0.7, dt)); sSpring(AS.th, 'v', P_.thumb, 520, 0.7, dt); sSpring(AS.spd, 'v', P_.spread, 400, 0.7, dt); }
      out.hands[k] = sHand(wx, wy, s * (A.fs || 1), AS.ha + shk_, { curls: AS.c.map((c) => clamp(c.v, 0, 1)), thumb: clamp(AS.th.v, 0, 1), spread: clamp(AS.spd.v, 0, 1), side: up ? sd : -sd, heat: aHeat, hold: A.hold, layer: A.layer }, t);
      out.hands[k].shudder = AS.shud;
      AS.px = wx; AS.py = wy; AS.fresh = false;
    };
    const arms = o.arms || [];
    for (let k = 0; k < 4; k++) if (arms[k] && !arms[k].front) drawArm(k, arms[k]);
    // the mask
    if (o.mask !== false) {
      const R = 30 * s, x0 = Math.max(0, fl(mcx - R)), x1 = Math.min(W - 1, Math.ceil(mcx + R)), y0 = Math.max(0, fl(mcy - R)), y1 = Math.min(H - 1, Math.ceil(mcy + R));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        let qx = (x + 0.5 - mcx) / s, qy = (y + 0.5 - mcy) / s;
        if (spl > 0) { let hit = null; for (const sd of [1, -1]) { const [ox, oy] = slide(sd), ax = qx - ox, ay = qy - oy; if (side(ax, ay) === sd) { hit = [ax, ay]; break; } } if (!hit) continue; qx = hit[0]; qy = hit[1]; }
        const mx = qx * cT + qy * sT, my = -qx * sT + qy * cT;
        let c = sMaskPx(mx, my, x, y, t, o); if (c < 0) continue;
        if (dark > 0 && c < 103 && c !== 22 && c !== 107 && bay(x, y) < dark) c = 96;
        BUF[y * W + x] = c;
      }
      for (const sd of [-1, 1]) out.eyes.push([mcx + (sd * 8.2 * cT - (-1.2) * sT) * s, mcy + (sd * 8.2 * sT + (-1.2) * cT) * s]);
      const eo = o.eyes === undefined ? 1 : o.eyes;
      if (eo > 0.3) for (const [ex, ey] of out.eyes) glow(ex, ey, 9 * s * Math.min(1.6, eo), T_EMBER, 0.3 * Math.min(1.5, eo));
      if (o.third > 0.3) glow(out.brow[0], out.brow[1] - 0.5 * s, 14 * s, T_MAG, 0.4 * o.third);
    }
    for (let k = 0; k < 4; k++) if (arms[k] && arms[k].front) drawArm(k, arms[k]);
    // the split: light pouring out of the cut
    if (spl > 0) { const [ax, ay] = LS(spx - sux * 200, spy - suy * 200), [bx, by] = LS(spx + sux * 200, spy + suy * 200); glow((ax + bx) / 2, (ay + by) / 2, 160 * s, T_WH, 0.4 * Math.min(1, spl * 3)); }
    return out;
  }

  /* ================================================================ part IV: the world below, and the scale of the powers */
  const OCEAN = [114, 115, 116, 117, 118, 119], ASH = [120, 121, 122, 123];
  const T_NOVA = mkTab('ffb850', true), T_FIRE = mkTab('ff2a10', true), T_DEEP = mkTab('050203', false);
  const SKY_BLOOD = [96, 97, 98, 101, 102], SKY_ASH = [96, 120, 97, 121, 98];
  const SM_NOVA = [110, 109, 108], SM_LAST = [103, 104, 107], SM_INF = [85, 83, 22];
  SMEAR_OF.nova = SM_NOVA; SMEAR_OF.lastlight = SM_LAST; SMEAR_OF.infinite = SM_INF;

  // under the cloud sea: a dark ocean to the horizon at hz, swells moving, rock spires standing out of it (three depths,
  // the near ones larger and faster with ox); burn (0..1) lights their broken tops with fire
  function belowWorld(t, hz, ox, burn, skyCols, light) {
    gradient(LB, hz, skyCols || SKY_BLOOD);
    const LX = light === undefined ? 300 : light, deep = H - LB;
    // the underside of the cloud sea, far above: heavy, lit red from below by the fire of the world
    for (let k = 0; k < 16; k++) { const x = ((ih(k, 1, 1105) * 620 - ox * 0.15) % 620 + 620) % 620 - 70, y = LB - 6 + ih(k, 2, 1105) * 16, r = 20 + ih(k, 3, 1105) * 26; cloudPuff(x, y, r, [96, 97, 98, 101], 1106 + k); }
    for (let x = 0; x < W; x++) for (let y = LB; y < LB + 30; y++) { const i = y * W + x; if (BUF[i] === 101 && bay(x, y) < 0.5) BUF[i] = 102; }
    // the ocean: swells, a band of reflected fire under the light, foam on the crests
    for (let y = Math.max(LB, fl(hz)); y < deep; y++) {
      const u = (y - hz) / Math.max(1, deep - hz), base = fl(u * 3.2);
      for (let x = 0; x < W; x++) {
        const sw = Math.sin(x * 0.05 / (0.2 + u) + t * 1.2 + y * 0.9) + Math.sin(x * 0.013 / (0.2 + u) - t * 0.7 + y * 0.31);
        let c = OCEAN[clamp(base + (sw > 1.2 ? 2 : sw > 0.6 ? 1 : 0) - (bay(x, y) > 0.5 + u * 0.4 ? 1 : 0), 0, 3)];
        if (sw > 1.75 && u > 0.1) c = u > 0.5 ? 119 : 118;
        // the reflection: a broken column of fire on the water under the light, wider toward us
        const rw = 14 + u * 70, dxr = Math.abs(x - LX - Math.sin(y * 0.7 + t * 2) * (2 + u * 6));
        if (dxr < rw && sw > 0.2 - (1 - dxr / rw) * 0.9 && ih(x >> 1, y, fl(t * 8)) < 0.85) c = sw > 1.2 ? 105 : sw > 0.7 ? 103 : 102;
        BUF[y * W + x] = c;
      }
    }
    // the spires: faceted columns of rock (a lit face and a shadowed face), banded with strata, burning at the top,
    // standing in mist; three depths, the far ones paler with distance
    for (let layer = 0; layer < 3; layer++) {
      const n = 7 - layer * 2, par = 0.3 + layer * 0.5, sc = 0.6 + layer * 0.55;
      const LIT = layer === 0 ? [99, 100, 121] : layer === 1 ? [98, 99, 100] : [97, 99, 100], SH = layer === 0 ? 98 : layer === 1 ? 97 : 96;
      for (let k = 0; k < n; k++) {
        const bx = ((ih(k, layer, 1101) * 640 - ox * par) % 640 + 640) % 640 - 80, bw = (14 + ih(k, 2, 1101 + layer) * 26) * sc, bh = (40 + ih(k, 3, 1101 + layer) * 90) * sc, by = hz + 6 + layer * 18;
        const lean = (ih(k, 4, 1101 + layer) - 0.5) * 0.25, ridge = (ih(k, 5, 1101 + layer) - 0.5) * 0.5;
        for (let y = fl(by - bh); y < by + 4; y++) {
          if (y < LB || y >= deep) continue;
          const v = (by - y) / bh, cxr = bx + lean * (by - y), half = bw * (0.25 + 0.75 * Math.pow(Math.max(0, 1 - v), 0.6)) * (0.8 + 0.4 * vn(y * 0.2, k, 1, 1102 + layer));
          const top = by - bh + (vn((y + k * 13) * 0.5, k, 1, 1107) - 0.5) * 6 * sc;
          for (let x = fl(cxr - half); x <= cxr + half; x++) {
            if (x < 0 || x >= W) continue;
            const f = (x - cxr) / half, onLit = f < ridge * (1 - v);
            const strata = frac((y + vn(x * 0.2, k, 1, 1108) * 3) / (7 * sc)) < 0.14;
            let c = onLit ? LIT[f < -0.75 ? 2 : f < -0.3 ? 1 : 0] : SH;
            if (strata) c = onLit ? LIT[0] - 1 : 96;
            if (Math.abs(f) > 0.9) c = 96;
            if (burn > 0 && v > 0.85 && ih(x, y, 1103) < burn) c = v > 0.95 ? 105 : 103;
            BUF[y * W + x] = c;
          }
        }
        // mist where it meets the sea
        for (let q = 0; q < 6; q++) { const mx = bx + (ih(k, q, 1109 + layer) - 0.5) * bw * 2.2, my = by + 1 + Math.sin(t * 0.8 + q + k) * 1.5; cloudPuff(mx, my, (5 + q) * sc, [116, 117, 117, 118], 1110 + k * 7 + q); }
      }
    }
    if (burn > 0) glow(240, hz, 300, T_EMBER, 0.25 * burn);
    glow(LX, hz, 110, T_EMBER, 0.3);
  }
  // the cloud sea seen from just above, torn by the fight: holes (centres, radii) blown through it show the ocean below
  function cloudSea(t, y0, ox, cols, holes) {
    cloudBank(y0, 34, 70, 1111, ox + t * 6, cols, false);
    cloudBank(y0 + 26, 44, 50, 1112, ox * 1.3 + t * 9, cols, false);
    for (const [hx, hy, hr] of holes || []) for (let y = Math.max(LB, fl(hy - hr * 0.4)); y < Math.min(H - LB, hy + hr * 0.4); y++) for (let x = Math.max(0, fl(hx - hr)); x < Math.min(W, hx + hr); x++) {
      const dx = (x - hx) / hr, dy = (y - hy) / (hr * 0.4), d = dx * dx + dy * dy; if (d > 1) continue;
      BUF[y * W + x] = d > 0.8 ? (bay(x, y) < 0.5 ? cols[0] : 101) : d > 0.65 ? 103 : OCEAN[clamp(fl(1 + (1 - d) * 2), 0, 3)];
    }
  }

  /* the great blade: the sword grown past all sense. From the hand (hx, hy) along angle a for len px (it may run far off the
     frame), w px wide at the guard. o: form ('gold' | 'nova' | 'lastlight' | 'infinite' | 'steel'), grow 0..1 (the blade is
     still racing out: rings of light run along it and its tip is white-hot), snap (0..1 along: broken there — gap and the
     far part shifted by o.snapOff [dx, dy]), cracks 0..1, flare 0..1 (light spilling round it). Returns the tip [x, y]. */
  const BLADE_COLS = {
    gold: [58, 59, 60, 22], nova: [110, 109, 108, 22], lastlight: [102, 104, 107, 22], infinite: null, steel: [33, 34, 21, 22],
  };
  function bigBlade(hx, hy, a, len, w, t, o) {
    o = o || {};
    const form = o.form || 'gold', cols = BLADE_COLS[form], ux = Math.cos(a), uy = Math.sin(a), grow = o.grow === undefined ? 1 : o.grow;
    const L = len * grow, tipK = 0.86;
    // the guard and grip at the hand
    const gw = w * 1.7, gx = -uy, gy = ux;
    capsF(hx - gx * gw, hy - gy * gw, hx + gx * gw, hy + gy * gw, Math.max(1.5, w * 0.28), Math.max(1.5, w * 0.28), (u, d) => d > 0.7 ? 51 : 58);
    capsF(hx - ux * w * 1.4, hy - uy * w * 1.4, hx, hy, Math.max(1.2, w * 0.2), Math.max(1.2, w * 0.2), () => 38);
    // the blade, clipped to the frame
    const reach = Math.min(L, 2000), tx = hx + ux * reach, ty = hy + uy * reach;
    const pad = w * 3 + 4, x0 = Math.max(0, fl(Math.min(hx, tx) - pad)), x1 = Math.min(W - 1, Math.ceil(Math.max(hx, tx) + pad)), y0 = Math.max(LB, fl(Math.min(hy, ty) - pad)), y1 = Math.min(H - LB - 1, Math.ceil(Math.max(hy, ty) + pad));
    const snap = o.snap, so = o.snapOff || [0, 0], flare = o.flare === undefined ? 0.6 : o.flare, Tg = form === 'nova' ? T_NOVA : form === 'lastlight' ? T_EMBER : form === 'infinite' ? T_WH : T_GOLD;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let px = x + 0.5 - hx, py = y + 0.5 - hy;
      let along = px * ux + py * uy;
      if (snap !== undefined && along > snap * L + w * 0.5) { px -= so[0]; py -= so[1]; along = px * ux + py * uy; if (along < snap * L + w * 0.5) continue; }
      const across = -px * uy + py * ux;
      if (along < w * 0.6 || along > L) { continue; }
      const f = along / L, half = (f < tipK ? w : w * Math.max(0, (1 - f) / (1 - tipK))) * (snap !== undefined && Math.abs(along - snap * L) < w * 0.5 ? 0 : 1), ad = Math.abs(across);
      if (ad > half) {
        // light spilling off the edge
        if (flare > 0 && ad < half + w * 2.2) tintI(y * W + x, x, y, Tg, flare * 0.6 * (1 - (ad - half) / (w * 2.2)));
        continue;
      }
      const e = ad / Math.max(0.5, half);
      let c;
      if (form === 'infinite') { const k = ((fl(along / 9 - t * 30) % 7) + 7) % 7; c = e < 0.35 ? 22 : e < 0.6 ? 60 : PRISM_C[k]; }
      else c = e < 0.3 ? cols[3] : e < 0.55 ? cols[2] : e < 0.82 ? cols[1] : cols[0];
      // energy racing out along it while it grows, and the fuller the blade the brighter its spine
      if (grow < 1 || o.surge) { const ph = frac(along / (w * 7) - t * 6); if (ph < 0.12 && e < 0.8) c = 22; }
      if (o.cracks > 0 && ih(fl(along / 6), fl(across / 3), 1121) < o.cracks * 0.15 && e > 0.2) c = form === 'lastlight' ? 22 : 96;
      if (f > 0.97 && grow < 1) c = 22;
      BUF[y * W + x] = c;
    }
    if (grow < 1) glow(hx + ux * Math.min(L, 600), hy + uy * Math.min(L, 600), w * 8, T_WH, 0.6);
    return [hx + ux * L, hy + uy * L];
  }

  // the frame breaks like glass round (cx, cy): cracks race out (amt 0..0.6), then the pieces shift and tilt (0.6..1)
  function frameCrack(cx, cy, amt, seed, maxR) {
    if (amt <= 0) return;
    seed = seed || 1131;
    const n = 14, gr = clamp((amt - 0.55) / 0.45, 0, 1), MR = maxR || 520;
    if (gr > 0) {
      TMP.set(BUF);
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
        const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy); if (r > MR) continue; const sec = fl(((Math.atan2(dy, dx) + PI) / TAU) * n + vn(r * 0.01, 0, 1, seed) * 0.6), ring = fl(r / 60);
        const k = sec * 7 + ring, ox = (ih(k, 1, seed) - 0.5) * 8 * gr + Math.cos(sec / n * TAU) * ring * 2 * gr, oy = (ih(k, 2, seed) - 0.5) * 8 * gr + Math.sin(sec / n * TAU) * ring * 2 * gr;
        BUF[y * W + x] = TMP[clamp(fl(y - oy), LB, H - LB - 1) * W + clamp(fl(x - ox), 0, W - 1)];
      }
    }
    for (let k = 0; k < n; k++) {
      let a = (k + ih(k, 3, seed) * 0.6) / n * TAU - PI, x = cx, y = cy;
      const Lmax = MR * Math.min(1, amt / 0.55);
      for (let q = 0; q < 40 && Math.hypot(x - cx, y - cy) < Lmax; q++) {
        const st = 9 + ih(k, q, seed + 1) * 12, nx = x + Math.cos(a) * st, ny = y + Math.sin(a) * st;
        lineP(x, y, nx, ny, 22); lineP(x + 1, y, nx + 1, ny, 0);
        if (ih(k, q, seed + 2) < 0.12) { const b = a + (ih(k, q, seed + 3) - 0.5) * 1.6; lineP(nx, ny, nx + Math.cos(b) * 18, ny + Math.sin(b) * 18, 22); }
        x = nx; y = ny; a += (ih(k, q, seed + 4) - 0.5) * 0.5;
      }
    }
    for (let ringR = 30; ringR < Math.min(300, MR * 0.7) * Math.min(1, amt / 0.55); ringR += 55) for (let k = 0; k < n; k++) if (ih(k, ringR, seed + 5) < 0.6) { const a0 = k / n * TAU - PI, a1 = (k + 1) / n * TAU - PI; lineP(cx + Math.cos(a0) * ringR, cy + Math.sin(a0) * ringR, cx + Math.cos(a1) * ringR * 1.04, cy + Math.sin(a1) * ringR * 1.04, 22); }
  }

  // the world split along a line through (x0, y0) at angle a: the two sides slide apart by gap px, the chasm between
  // burning; amt 0..1 how far the split has run along its length from (x0, y0) (both ways)
  function worldSplit(x0, y0, a, gap, amt, t) {
    if (gap <= 0.3 || amt <= 0) return;
    TMP.set(BUF);
    const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, reach = amt * 700;
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const px = x - x0, py = y - y0, along = px * ux + py * uy, d = px * nx + py * ny;
      if (Math.abs(along) > reach) continue;
      const g = gap * (1 - Math.pow(Math.abs(along) / reach, 3)) * 0.5;
      if (Math.abs(d) < g) {
        const e = Math.abs(d) / g; BUF[y * W + x] = e < 0.25 ? 22 : e < 0.5 ? 107 : e < 0.75 ? 105 : e < 0.9 ? 103 : 101;
        continue;
      }
      const sd = d > 0 ? 1 : -1, sx = x - nx * g * sd, sy = y - ny * g * sd;
      BUF[y * W + x] = TMP[clamp(fl(sy), LB, H - LB - 1) * W + clamp(fl(sx), 0, W - 1)];
    }
    for (let k = 0; k < 30; k++) { const s = (ih(k, 1, 1141) - 0.5) * 2 * reach, f = frac(t * 0.8 + ih(k, 2, 1141)); P(x0 + ux * s + nx * (ih(k, 3, 1141) - 0.5) * gap, y0 + uy * s + ny * (ih(k, 3, 1141) - 0.5) * gap - f * 40, f < 0.5 ? 105 : 103); }
  }

  // chunks of rock (or porcelain, or ice of light) thrown from (cx, cy): g seconds since, n pieces, speed v, gravity
  function rocks(cx, cy, g, n, v, size, cols, seed, grav, dir, spread) {
    if (g < 0) return;
    for (let k = 0; k < n; k++) {
      const a = (dir === undefined ? ih(k, 1, seed) * TAU : dir + (ih(k, 1, seed) - 0.5) * (spread || 1.4)), sp = v * (0.35 + ih(k, 2, seed) * 0.8);
      const x = cx + Math.cos(a) * sp * g, y = cy + Math.sin(a) * sp * g + (grav === undefined ? 160 : grav) * g * g, r = size * (0.4 + ih(k, 3, seed) * 0.9), rot = g * (3 + ih(k, 4, seed) * 6) + k;
      if (x < -r * 2 || x > W + r * 2 || y < -r * 2 || y > H + r * 2) continue;
      const pts = []; for (let q = 0; q < 6; q++) { const aa = rot + q / 6 * TAU, rr = r * (0.7 + ih(k, q + 9, seed) * 0.5); pts.push([x + Math.cos(aa) * rr, y + Math.sin(aa) * rr]); }
      for (let q = 0; q < 6; q++) { const [ax, ay] = pts[q], [bx, by] = pts[(q + 1) % 6]; z5Tri(x, y, ax, ay, bx, by, q < 2 ? cols[2] : q < 4 ? cols[1] : cols[0]); }
      if (cols[3] !== undefined && r > 2) P(x, y, cols[3]);
    }
  }

  // the black sun: a hole where the light was, a rim of fire, tongues of corona lashing out; it drinks the light round it
  function blackSun(cx, cy, r, t, amt) {
    if (amt <= 0) return;
    const R = r * 3.2, x0 = Math.max(0, fl(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R)), y0 = Math.max(LB, fl(cy - R)), y1 = Math.min(H - LB - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy), an = Math.atan2(dy, dx);
      if (d < r) { BUF[y * W + x] = d > r - 1.6 ? 105 : d > r - 3 ? 102 : 0; continue; }
      const tongue = r * (1.15 + 0.5 * Math.max(0, Math.sin(an * 7 + t * 2.3) * Math.sin(an * 3 - t * 1.1)) + 0.35 * vn(an * 4 + t, 0, 1, 1151)) * amt;
      if (d < tongue) { const e = (d - r) / Math.max(1, tongue - r); BUF[y * W + x] = e < 0.2 ? 107 : e < 0.45 ? 105 : e < 0.7 ? 103 : bay(x, y) < 0.5 ? 102 : 101; continue; }
      if (d < R) tintI(y * W + x, x, y, T_DEEP, amt * 0.75 * (1 - (d - tongue) / (R - tongue)));
    }
  }

  // pixels round (cx, cy) dragged toward it (amt > 0) or thrown out from it (amt < 0) within R — gravity bending the picture
  function warp(cx, cy, R, amt, sy) {
    if (Math.abs(amt) < 0.01) return;
    TMP.set(BUF); sy = sy || 1;
    const x0 = Math.max(0, fl(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R)), y0 = Math.max(LB, fl(cy - R / sy)), y1 = Math.min(H - LB - 1, Math.ceil(cy + R / sy));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = (y - cy) * sy, d = Math.sqrt(dx * dx + dy * dy); if (d >= R || d < 0.5) continue;
      const f = 1 - d / R, k = 1 + amt * f * f;
      BUF[y * W + x] = TMP[clamp(fl(cy + (y - cy) * k), LB, H - LB - 1) * W + clamp(fl(cx + dx * k), 0, W - 1)];
    }
  }

  /* the weight of a blow: one call for a heavy hit at (x, y), g seconds after it. power 1 (hard) .. 4 (world-breaking);
     dir the angle it travels (debris and streaks fly that way). One impact frame only (never a strobe), rings, a burst of
     debris and sparks, light, a shake — and from power 3 the frame itself cracks. */
  function megaHit(x, y, g, power, dir, cols, seed) {
    if (g < 0 || g > 1.2) return;
    cols = cols || [22, 105, 103]; seed = seed || 1161;
    if (g < 0.03) impactFrame(x, y, power >= 2.5 ? 1 : 0);
    const P_ = power;
    if (g < 0.5) {
      shockRing(x, y, 8 + g * 420 * P_, 5 + g * 240 * P_, 2 + P_, [22, cols[1], cols[2]], 1 - g / 0.5);
      if (P_ >= 2) shockRing(x, y, 4 + g * 260 * P_, 3 + g * 90 * P_, 2, [cols[1], cols[2], 101], 1 - g / 0.45);
      burst(x, y, g / 0.3, 70 * P_, 14 + 4 * P_, ih(fl(x), fl(y), seed) * TAU, [cols[0], cols[1]], 3);
    }
    for (let k = 0; k < 14 + 8 * P_; k++) {
      const a = dir === undefined ? ih(k, 1, seed) * TAU : dir + (ih(k, 1, seed) - 0.5) * 1.5, v = (90 + ih(k, 2, seed) * 260) * Math.sqrt(P_), px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 120 * g * g;
      if (g < 0.6) lineP(px, py, px - Math.cos(a) * (6 + P_ * 3), py - Math.sin(a) * (6 + P_ * 3), g < 0.15 ? cols[0] : cols[1]);
    }
    glow(x, y, 40 * P_ * Math.max(0, 1 - g * 1.8), T_WH, 0.75);
    glow(x, y, 70 * P_ * Math.max(0, 1 - g * 1.2), cols[1] >= 101 && cols[1] <= 107 ? T_EMBER : T_GOLD, 0.45);
    shk(4 * P_ * Math.max(0, 1 - g * 2.5));
    if (P_ >= 3 && g < 0.9) frameCrack(x, y, Math.min(1, g * 4) * (1 - sstep(0.6, 0.9, g)), seed + 7);
  }
  // a camera kick for a list of hits: returns [zoom add, roll add, dx, dy] decaying after each
  function kick(t, hits, amt) {
    let z = 0, r = 0, dx = 0, dy = 0;
    for (const [h, p, dir] of hits) { const g = t - h; if (g < 0 || g > 1.5) continue; const e = Math.exp(-g * 7) * (p || 1) * (amt || 1); z += 0.05 * e; r += 0.03 * e * Math.cos(g * 30) * ((h * 7) % 2 < 1 ? 1 : -1); if (dir !== undefined) { dx += Math.cos(dir) * 10 * e * Math.cos(g * 18); dy += Math.sin(dir) * 10 * e * Math.cos(g * 18); } }
    return [z, r, dx, dy];
  }

  /* ================================================================ part IV, act I (0:00–0:21): the brother */
  {
  // part III's last sky (same seeds): the dawn over the cloud sea; red tints it the colour of what is coming
  function i4Sky(t, red) {
    gradient(LB, 150, [6, 7, 8, 13, 14, 15]);
    glow(390, 150, 150, T_WARM, 0.55 * (1 - red));
    cloudBank(140, 34, 70, 5321, t * 5, CLOUD_SUN, false);
    cloudBank(196, 44, 50, 5322, t * 8, [17, 18, 14, 15], false);
    if (red > 0) tintAll(T_BLOOD, red * 0.3);
  }
  const i4Coral = (o) => HERO3(Object.assign({ sword: -1.0, swordCols: z5Sw(T_NOW * 0.3) }, o));
  // clouds thrown up and spilling back down: n puffs from (cx, cy), g seconds after
  function i4CloudSpill(cx, cy, g, n, v, seed, cols) {
    for (let k = 0; k < n; k++) {
      const a = -PI / 2 + (ih(k, 1, seed) - 0.5) * 2.2, sp = v * (0.4 + ih(k, 2, seed) * 0.8), r = 6 + ih(k, 3, seed) * 12;
      const x = cx + Math.cos(a) * sp * g, y = cy + Math.sin(a) * sp * g + 110 * g * g;
      if (y < cy + 30) cloudPuff(x, y, r * (1 - Math.min(0.5, g * 0.3)), cols || [18, 19, 15, 16], seed + k);
    }
  }

  /* 1 — one eye (0:00–0:04): part III's last frame, coming back up out of the dark. The shard rocks in the cloud; its eye
     darts; then the cloud beneath it starts to burn from below, and it trembles */
  shot(0, 4.0, (lt, t) => {
    i4Sky(t, 0);
    const burn = sstep(1.5, 3.9, lt), tremble = sstep(3.0, 4.0, lt);
    const sx = 236 + z5N(t * 0.6, 1) * 2 + z5Sh(t, 3) * 1.6 * tremble, sy = 182 + lt * 0.8 + Math.sin(t * 1.4) * 1.2;
    glow(sx, sy + 46, 70 + 70 * burn, T_EMBER, 0.75 * burn);
    glow(sx, sy + 46, 30 + 30 * burn, T_BLOOD, 0.5 * burn);
    const look = lt < 2.6 ? Math.sin(lt * 2.6) * 0.9 : Math.sin(2.6 * 2.6) * 0.9 * (1 - eio(lin(2.6, 3.0, lt)));
    if (burn > 0.05) glow(sx + 2, sy - 2, 56, T_MAG, 0.4);
    z5MaskShard(sx, sy, 2.4, 0.16 + Math.sin(t * 2) * 0.02 + z5Sh(t, 2) * 0.05 * tremble, 1, look, t);
    for (let k = 0; k < 5; k++) cloudPuff(sx - 48 + k * 24, sy + 26 + (k & 1) * 5, 13 + (k % 3) * 3, [18, 19, 15, 16], 5323 + k);
    // fire showing through the gaps of the cloud below, flickering
    for (let k = 0; k < 26 * burn; k++) { const x = sx - 70 + ih(k, 1, 4101) * 140, y = sy + 34 + ih(k, 2, 4101) * 20; if (ih(k, fl(t * 12), 4102) < 0.6) rectF(x, y, 2 + (k % 3), 1, ih(k, 3, 4101) < 0.4 ? 104 : 103); }
    shk(tremble * 2);
    z5Cam(1.7 + 0.08 * eio(lt / 4), 0.004 * z5N(t * 0.5, 4), sx - 4, sy, 240, 135);
    if (lt < 1.2) tintAll(T_DARK, 1 - eio(lt / 1.2));
  });
  CAPS.push([0.4, 3.2, 'n', '', 'ONE EYE STILL WATCHED.']);

  /* 2 — the hand (0:04–0:05.2): a gauntlet the size of a hill bursts up through the cloud and closes round the shard */
  shot(4.0, 5.2, (lt, t) => {
    i4Sky(t, 0.15);
    const SX = 236, SY = 184;
    // up it comes (fast), opens, closes round the shard (a little overshoot), and is drawn back down with its prize
    const rise = eoc(clamp(lt / 0.16, 0, 1)), grab = lt > 0.3, down = eic(clamp((lt - 0.62) / 0.5, 0, 1));
    const wy = lerp(380, SY + 52, rise) + z5Knock(lt - 0.3, 4, 18, 6) + down * 220, wx = SX + 2 + z5Sh(t, 5) * 1.5;
    const shy = grab ? SY + (wy - (SY + 52)) : SY - z5Knock(lt - 0.02, 6, 10, 5);
    glow(SX, SY + 40, 160, T_EMBER, 0.7 * (1 - down));
    // the fingers close round it over four frames, the palm behind it, the fingers over it; inside, its eye thrashes
    const cl = grab ? eoc(clamp((lt - 0.3) / 0.13, 0, 1)) : 0, sq_ = grab ? z5Knock(lt - 0.43, 0.12, 20, 6) : 0;
    const shard = () => z5MaskShard(SX + z5Sh(t * 2, 3) * 2 * cl, shy - 4 - cl * 6, 2.2 - cl * 0.25, 0.16 + (grab ? 0.35 : lt * 2), 1, grab ? Math.sin(t * 30) * 0.9 : 0, t);
    if (!grab) shard();
    sGauntlet(wx, wy, 3.4, -PI / 2, { curl: lerp(0.06, 0.72 + sq_, cl), thumb: lerp(0.05, 0.62, cl), spread: lerp(1, 0.25, cl) }, 0.8, t, grab ? { hold: shard } : undefined);
    if (grab && lt < 0.5) glow(SX, shy, 50, T_MAG, 0.5 * (1 - cl * 0.6));
    // the cloud erupting round the arm, and its tatters falling back
    i4CloudSpill(SX, SY + 30, lt, 26, 260, 4111);
    for (let k = 0; k < 6; k++) cloudPuff(SX - 120 + k * 48, SY + 40 + (k & 1) * 6, 16 + (k % 3) * 4, [17, 18, 14, 15], 4112 + k);
    megaHit(SX, SY + 20, lt, 2, -PI / 2, [22, 105, 103], 4113);
    shk(lt < 0.5 ? 6 : 3 * (1 - down));
    const [kz, kr] = kick(lt, [[0, 1.4], [0.3, 0.6]]);
    z5Cam(1.4 + kz - down * 0.1, kr, SX, SY - 10, 240, 135);
  });
  FLASH_CUTS.push(4.0);

  /* 3 — he rises (0:05.2–0:07): wide. The hero spins round; the whole cloud sea heaves and splits and a mountain comes up
     out of it — the crown of blades first, then the mask; the sun goes behind his head */
  const SUN = [330, 150];
  shot(5.2, 7.0, (lt, t) => {
    z5Dawn(t, 150, t * 8, SUN[0], SUN[1]);
    const u = clamp(lt / 1.8, 0, 1), surge = eio(u) + Math.max(0, Math.sin(u * PI * 3)) * 0.03;
    const my = lerp(320, 112, surge), sx = 330 + z5Sh(t, 7) * 1.5;
    const eclipse = sstep(140, 115, my);                     // the head passing over the sun
    if (eclipse > 0) glow(SUN[0], SUN[1], 120, T_WARM, 0.5 * eclipse);
    sunderer(sx, my, 1.5, t, { eyes: 0, heat: 0.15, dark: 0.55 + 0.35 * eclipse, crown: 1, glow: 0.2, arms: [{ x: -150, y: 150, pose: 'fist' }, { x: 150, y: 130, pose: 'grab' }, null, null] });
    // the cloud sea in front of his body, and the cloud he displaces: thrown up, spilling off his shoulders
    cloudBank(200, 44, 50, 4121, t * 8, CLOUD_NEAR, false);
    i4CloudSpill(sx - 140, 200, frac(lt * 0.9), 10, 120, 4122, CLOUD_NEAR);
    i4CloudSpill(sx + 140, 200, frac(lt * 0.9 + 0.5), 10, 120, 4123, CLOUD_NEAR);
    for (let k = 0; k < 8; k++) { const g = frac(lt * 0.7 + k / 8), side = k & 1 ? 1 : -1; cloudPuff(sx + side * (110 + g * 30), my + 80 + g * 120, 9 + (k % 3) * 3, CLOUD_NEAR, 4124 + k); }
    // the hero, small, in the foreground left: it was facing away; it spins round
    const turn = lt > 0.25, hop = z5Knock(lt - 0.25, -6, 10, 4);
    actor(i4Coral({ eyes: lt > 0.3 ? 'wide' : 'normal', sword: lt > 0.5 ? -0.6 : -1.0 }), 112, 126 + hop, 1.7, 0, !turn);
    shk(1 + u * 4);
    z5Cam(1 + 0.04 * u, 0.01 * z5Sh(t * 0.3, 2), 240, 135);
  });

  /* 4 — his eyes (0:07–0:10.6): low, looking up at him with the sun burning behind his head. The eyes ignite; the fire
     runs out through him from the heart; he lifts the fist with the shard in it into the light — "You broke my brother." */
  shot(7.0, 10.6, (lt, t) => {
    gradient(LB, H - LB, [7, 8, 13, 14, 15, 16]);
    const MX = 240, MY = 126, s = 2.3;
    glow(MX, MY - 34, 170, T_WARM, 0.7); discF(MX, MY - 36, 30, 16); discF(MX, MY - 36, 26, 22);
    cloudBank(236, 30, 60, 4131, t * 6, CLOUD_NEAR, false);
    const ign = eob(clamp(lt / 0.16, 0, 1)), heat = 0.15 + 0.7 * eio(lin(0.1, 2.0, lt)), dark = lerp(0.85, 0.25, eio(lin(0.2, 2.0, lt)));
    const lift = eio(lin(0.9, 1.8, lt));
    const hand = [lerp(160, 52, lift), lerp(160, 22, lift)];
    const o = sunderer(MX, MY + 1.6 * z5N(t * 0.5, 1), s, t, { eyes: ign * 1.3, heat, dark, crown: 1, nod: -1 + lift * 1.6, tilt: -0.04 * lift,
      arms: [{ x: -120, y: 140, pose: 'fist' }, { x: hand[0], y: hand[1], pose: lift > 0.5 ? 'grab' : 'fist', front: true, ang: -PI / 2 - 0.4 * lift,
        // the shard, held up in his loosened grip between palm and fingers (its eye looking at its brother)
        hold: lift > 0.2 ? (h) => { glow(h.palm[0], h.palm[1], 50, T_MAG, 0.5); z5MaskShard(h.palm[0] + h.ux * 9 * s, h.palm[1] + h.uy * 9 * s, 1.5, 0.4 + Math.sin(t * 2) * 0.05, 1, -0.6, t); } : undefined }, null, null] });
    if (lt < 0.067) tintAll(T_BLOOD, 0.4);
    for (const [ex, ey] of o.eyes) glow(ex, ey, 40 * ign, T_EMBER, 0.5 * Math.max(0, 1 - lt / 0.6));
    shk(lt < 0.4 ? 5 * (1 - lt / 0.4) : 0.6);
    const [kz] = kick(lt, [[0, 1.5]]);
    z5Cam(1.02 + 0.06 * eio(lt / 3.6) + kz, -0.02 + 0.01 * z5N(t * 0.4, 2), 240, 140, 240, 135);
  });
  FLASH_CUTS.push(7.0);
  CAPS.push([8.0, 10.5, 's', 'SUNDERER', 'YOU BROKE MY BROTHER.']);

  /* 5 — the hero (0:10.6–0:13.2): close, small against a red sky and the shape of him; not backing down */
  shot(10.6, 13.2, (lt, t) => {
    gradient(LB, H - LB, [97, 98, 101, 102, 13, 14]);
    sunderer(380, 80, 1.0, t, { eyes: 1.3, heat: 0.6, dark: 0.8, crown: 1, arms: [null, { x: 70, y: 40, pose: 'grab', front: true }, null, null] });
    cloudBank(226, 30, 60, 4141, t * 10, [97, 98, 101, 102], false);
    for (let k = 0; k < 24; k++) { const g = frac(t * 0.35 + ih(k, 1, 4142)); rectF(W - g * 520, LB + ih(k, 2, 4142) * 200 + Math.sin(t + k) * 6, 2, 1, k % 3 ? 103 : 105); }
    const speak = lt > 0.15 && lt < 2.1 && Math.sin(t * 22) > -0.3 ? 1 : 0;
    const a = actor(i4Coral({ eyes: 'angry', shade: true, mouth: speak, sword: -1.25 + z5N(t, 3) * 0.04 }), 190 + 4 * eio(lt / 2.6), 172, 6.4, 0.03, false);
    // the light of him on the hero's right side
    for (let y = SMB[1]; y <= SMB[3]; y++) for (let x = SMB[0]; x <= SMB[2]; x++) { const i = y * W + x; if (SMASK[i] && !SMASK[i + 4]) tintI(i, x, y, T_EMBER, 0.55); }
    z5Cam(1 + 0.04 * eio(lt / 2.6), 0, 220, 150, 240, 135);
  });
  CAPS.push([10.8, 13.1, 's', 'HERO', 'HE WAS ERASING EVERYTHING.']);

  /* 6 — "He erased. I break." (0:13.2–0:16.2): he brings a fist up and clenches it, and the air round it cracks */
  shot(13.2, 16.2, (lt, t) => {
    gradient(LB, H - LB, [96, 97, 98, 101, 102, 13]);
    cloudBank(220, 30, 60, 4151, t * 6, [97, 98, 101, 102], false);
    const up = eio(lin(0.9, 1.6, lt)), clench = lt > 1.75;
    const sq = clench ? z5Knock(lt - 1.75, 6, 22, 7) : 0;
    const o = sunderer(300, 96, 1.4, t, { eyes: 1.2 + (clench ? 0.4 : 0), heat: 0.6 + (clench ? 0.3 : 0), rage: clench ? 0.3 : 0, crown: 1, nod: 0.6,
      arms: [{ x: lerp(-150, -60, up), y: lerp(140, 30, up) + sq, pose: clench ? 'fist' : 'open', front: true, ang: lerp(-PI / 2, -PI / 2 - 0.3, up) }, { x: 120, y: 120, pose: 'grab' }, null, null] });
    actor(i4Coral({ eyes: 'angry', sword: -0.9 }), 90, 178, 1.7, 0, false);
    if (clench) { const [fx, fy] = o.hands[0], g = lt - 1.75; frameCrack(fx, fy - 10, clamp(g * 3, 0, 0.5) * (1 - sstep(0.8, 1.2, g)), 4152, 70); glow(fx, fy, 50, T_EMBER, 0.5 * Math.exp(-g * 3)); shk(4 * Math.exp(-g * 4)); }
    z5Cam(1 + 0.05 * eio(lt / 3), 0, 260, 120, 250, 130);
  });
  CAPS.push([13.4, 16.1, 's', 'SUNDERER', 'HE ERASED. I BREAK.']);

  /* 7 — "Then try." (0:16.2–0:18): it gathers itself, and Zenith comes back: prism light, the wings, the orbs, the blade */
  shot(16.2, 18.0, (lt, t) => {
    gradient(LB, H - LB, [96, 97, 98, 101, 102, 13]);
    const ign = lt > 0.3, g = lt - 0.3, open = eob(clamp(g / 0.45, 0, 1));
    const HX = 240, HY = 158 - (ign ? 10 * eob(clamp(g / 0.5, 0, 1)) : 0) + (ign ? 0 : 5 * eio(lt / 0.3));
    if (ign) {
      z5Sunburst(HX, HY, 14, t * 0.4, 20, 260 * eoc(clamp(g / 0.3, 0, 1)), 0.08);
      z5Zenith(HX, HY, 3.2, t, { sw: -1.1, spread: open, orbR: 52 * open, auraR: 10, sparks: 24, eyes: 'glow', mouth: g < 0.3 ? 2 : 0 });
      if (g < 0.067) tintAll(T_WH, 0.5);
      shockRing(HX, HY, 10 + g * 500, 6 + g * 220, 4, PRISM_C, 1 - g / 0.6);
    } else actor(i4Coral({ eyes: 'angry', sword: -1.6, sq: 0.25 * eio(lt / 0.3) }), HX, HY, 3.2, 0, false);
    shk(ign ? 4 * Math.exp(-g * 3) : 1);
    z5Cam(1.08 - 0.06 * eoc(clamp(g / 0.6, 0, 1)), 0, HX, HY - 10, 240, 140);
  });
  CAPS.push([16.4, 17.9, 's', 'HERO', 'THEN TRY.']);

  /* 8 — "You will beg to be erased." (0:18–0:20): the mask, close; the mouth tears open on "beg"; the eyes flare */
  shot(18.0, 20.0, (lt, t) => {
    gradient(LB, H - LB, [96, 97, 98, 101]);
    const roar = Math.sin(PI * clamp((lt - 0.8) / 0.7, 0, 1)) * 0.8, flare = sstep(1.5, 1.65, lt);
    sunderer(240, 150 + lt * 2, 5.0, t, { eyes: 1.2 + flare * 0.7, rage: 0.2 + flare * 0.5, roar, heat: 0.8, body: false, crown: 1, nod: 1.2 * eio(lt / 2), tilt: 0.05 * eio(lt / 2) });
    shk(roar * 3 + flare * 2);
    z5Cam(1 + 0.05 * lt, 0, 240, 135);
  });
  CAPS.push([18.2, 19.95, 's', 'SUNDERER', 'YOU WILL BEG TO BE ERASED.']);

  /* 9 — THE SUNDERER (0:20–0:21): his name slammed across the frame — and split down the middle, like his face */
  shot(20.0, 21.0, (lt, t) => {
    gradient(LB, H - LB, [96, 97, 98, 101, 102]);
    sunderer(240, 150, 2.4, t, { eyes: 1.6, heat: 0.7, dark: 0.85, crown: 1, glow: 0.2 });
    tintAll(T_DARK, 0.45);
    const s = 'THE SUNDERER', sc = lt < 0.034 ? 9 : lt < 0.067 ? 8 : lt < 0.1 ? 7 : 6, w = textWidth(s, sc), x0 = 240 - w / 2, y0 = 118 - 3.5 * sc - 14 * (1 - eoc(clamp(lt / 0.1, 0, 1)));
    for (const [dx, c] of [[-3, 101], [3, 103]]) text(s, x0 + dx, y0, c, sc);
    text(s, x0, y0, (i, j) => (j < 2 ? 22 : j < 5 ? 105 : 103), sc, 96);
    worldSplit(240, 118, PI / 2 + 0.06, 3 + 4 * eoc(clamp((lt - 0.12) / 0.3, 0, 1)), eoc(clamp((lt - 0.1) / 0.2, 0, 1)), t);
    if (lt < 0.034) impactFrame(240, 118, 0);
    shk(lt < 0.4 ? 6 * (1 - lt / 0.4) : 0.5);
  });
  FLASH_CUTS.push(20.0);
  }

  /* ================================================================ part IV, act II (0:21–0:41): the wall */
  {
  const i4Coral = (o) => HERO3(Object.assign({ sword: -1.0, swordCols: z5Sw(T_NOW * 0.3) }, o));
  const SKY_FIGHT = [96, 97, 98, 101, 102, 13];
  // a one-off piecewise path: list of [t, x, y, ease] keys (ease into each key: 'o' out, 'i' in, 'io', 'b' back, 'l')
  function i4Path(keys, t) {
    if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
    for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) {
      const [t0, x0, y0] = keys[i - 1], [t1, x1, y1, e] = keys[i], u = (t - t0) / (t1 - t0), f = e === 'o' ? eoc(u) : e === 'i' ? eic(u) : e === 'b' ? eob(u) : e === 'l' ? u : eio(u);
      return [lerp(x0, x1, f), lerp(y0, y1, f)];
    }
    const k = keys[keys.length - 1]; return [k[1], k[2]];
  }
  // hit-stop that stays on the beat: the clock holds for d at each hit, then catches up over the next 0.2 s
  function i4Stop(t, hits, d) { let o = t; for (const h of hits) { const g = t - h; if (g > 0) o -= Math.min(g, d) - clamp((g - d) / 0.2, 0, 1) * d; } return o; }
  // sparks skidding off porcelain: a fan along dir
  function i4Skid(x, y, g, dir, n, seed) {
    if (g < 0 || g > 0.35) return;
    for (let k = 0; k < n; k++) { const a = dir + (ih(k, 1, seed) - 0.5) * 1.1, v = 120 + ih(k, 2, seed) * 260, px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 200 * g * g; lineP(px, py, px - Math.cos(a) * 5, py - Math.sin(a) * 5, g < 0.1 ? 22 : k % 2 ? 59 : 60); }
    if (g < 0.08) { discF(x, y, 5 - g * 40, 22); glow(x, y, 26, T_WH, 0.6); }
  }

  /* 10 — the blitz (0:21–0:24): Zenith at full speed, four cuts from four sides. He does not move. He does not blink.
     The blade skids off porcelain; it is the hero that is thrown back by each one */
  const BZ = [22.5, 22.9, 23.3, 23.7];
  shot(21.0, 24.0, (lt, t) => {
    gradient(LB, H - LB, SKY_FIGHT);
    cloudBank(222, 30, 60, 4201, t * 10, [97, 98, 101, 102], false);
    const MX = 300, MY = 96, s = 1.3;
    const o = sunderer(MX, MY, s, t, { eyes: 1.15, heat: 0.65, crown: 1, arms: [{ x: -132, y: 128, pose: 'fist' }, { x: 132, y: 124, pose: 'fist' }, { x: -96, y: 190, pose: 'open' }, { x: 96, y: 196, pose: 'open' }] });
    // the four contact points (on him) and where the hero comes from for each
    const C = [[MX - 108, MY + 52], [MX - 18, MY + 104], [MX + 26, MY + 34], [MX - 10, MY - 2]];
    const FROM = [[130, 210], [MX + 90, MY + 150], [MX - 30, MY + 120], [150, 70]];
    // the path: wind up (21.0–21.6), then each strike is an arrival on the contact point and a rebound away from it
    const keys = [[21.0, 92, 168], [21.55, 84, 176, 'io']];
    BZ.forEach((h, k) => { const [cx, cy] = C[k], [fx, fy] = FROM[k], dx = cx - fx, dy = cy - fy, L = Math.hypot(dx, dy); keys.push([h - 0.16, fx + dx * 0.25, fy + dy * 0.25, 'i'], [h, cx - dx / L * 22, cy - dy / L * 22, 'i'], [h + 0.14, cx - dx / L * 48, cy - dy / L * 48 + 6, 'o']); });
    const [hx, hy] = i4Path(keys, t);
    // the blade: cocked back as it comes in, whipped through the cut, bounced back by the porcelain
    const SWING = [[-2.8, 0.7], [1.7, -1.4], [2.0, -1.5], [-0.5, -0.3]];
    let sw = -1.1, flip = false, ang = 0, sq = 0, spread = 1;
    if (t < 21.55) { const w = eio(lin(21.0, 21.5, t)); sw = lerp(-1.1, -2.6, w); sq = 0.3 * w; spread = 1 - 0.6 * w; }
    BZ.forEach((h, k) => {
      const g = t - h; if (g < -0.2 || g > 0.36) return;
      const [a0, a1] = SWING[k]; flip = k === 1;
      sw = g < -0.06 ? a0 : g < 0 ? lerp(a0, a1, eic((g + 0.06) / 0.06)) : lerp(a1, a0 * 0.5, eoc(clamp(g / 0.25, 0, 1)));
      ang = (k === 2 ? -0.4 : k === 3 ? 0.2 : 0.25) * (flip ? -1 : 1);
      spread = g < 0 ? 0.55 : 0.55 + 0.45 * eoc(clamp(g / 0.3, 0, 1));
      if (k === 3) sw = g < -0.06 ? -0.3 : -0.3;
    });
    const caught = t > 23.7;
    z5Zenith(hx, hy, 2.0, t, { sw, flip, ang, spread, orbR: 22, auraR: 6, sparks: 10, sq, eyes: 'glow', mouth: caught ? 2 : 0 });
    // contact: sparks, a ring — small against his size; the hero gets the worst of it
    BZ.forEach((h, k) => { const [cx, cy] = C[k], g = t - h, dir = Math.atan2(cy - FROM[k][1], cx - FROM[k][0]) + PI * 0.75; i4Skid(cx, cy, g, dir, 22, 4202 + k); if (g >= 0 && g < 0.25) shockRing(cx, cy, 4 + g * 140, 3 + g * 90, 2, [22, 60, 59], 1 - g / 0.25); });
    // speed lines between the cuts
    if (t > 21.55) for (let q = 1; q < 6; q++) { const [ax, ay] = i4Path(keys, t - q * 0.02); P(ax, ay, PRISM_C[q % 7]); P(ax + 1, ay, PRISM_C[(q + 2) % 7]); }
    const [kz, kr] = kick(t, BZ.map((h) => [h, 0.5]));
    shk(BZ.some((h) => t > h && t < h + 0.12) ? 2 : 0.4);
    z5Cam(1.06 + kz, kr, lerp(220, hx, 0.35), lerp(140, hy, 0.25), 240, 135);
  });

  /* 11 — caught (0:24–0:25.4): the blade, stopped dead between two porcelain fingers. The hero hauls on it with
     everything — wings thrashing — and the hand does not so much as tremble */
  shot(24.0, 25.4, (lt, t) => {
    gradient(LB, H - LB, SKY_FIGHT);
    sunderer(380, 60, 1.6, t, { eyes: 1.2, heat: 0.6, crown: 1, dark: 0.3, arms: [null, null, null, null] });
    tintAll(T_DARK, 0.25);
    const PX = 300, PY = 140;                                  // the pinch: where the tip is held
    const tugs = [0.25, 0.62, 0.98], pull = tugs.reduce((s_, h) => s_ + Math.max(0, Math.sin(PI * clamp((lt - h) / 0.3, 0, 1))), 0);
    const S = 3.2, hx = PX - 29 * S - 14 * S - pull * 4, hy = PY + 2 + z5Sh(t, 2) * pull;
    // the hand: not one pixel of give. Palm behind the blade, finger and thumb closing on it (four frames), the hero in front
    const pin = eoc(clamp(lt / 0.13, 0, 1)), HP = { curls: [lerp(0.15, 0.48, pin), lerp(0.4, 0.95, pin), lerp(0.45, 0.98, pin), 1], thumb: lerp(0.2, 0.66, pin), spread: lerp(0.6, 0, pin) };
    sGauntlet(PX + 44, PY + 10, 3.4, PI + 0.3, HP, 0.6, t, { layer: 'palm' });
    z5Zenith(hx, hy, S, t, { sw: 0.04 * z5Sh(t * 2, 4), spread: 0.7 + 0.3 * pull, flap: 0.5, wt: t * 4, orbR: 0, auraR: 9, sparks: 18, sq: -0.12 * pull, eyes: 'glow', mouth: pull > 0.3 ? 2 : 1 });
    sGauntlet(PX + 44, PY + 10, 3.4, PI + 0.3, HP, 0.6, t, { layer: 'fingers' });
    // where porcelain grips light: the blade glows white there and grinds sparks on each tug
    tugs.forEach((h, k) => { const g = lt - h; if (g > 0 && g < 0.25) for (let q = 0; q < 6; q++) { const a = PI + (ih(q, k, 4212) - 0.5) * 1.8, v = 40 + ih(q, k + 3, 4212) * 90; P(PX + Math.cos(a) * v * g, PY + Math.sin(a) * v * g + 60 * g * g, q % 2 ? 22 : 60); } });
    glow(PX, PY, 30, T_WH, 0.35 + 0.2 * pull);
    if (lt < 0.1) { i4Skid(PX, PY, lt, PI, 30, 4211); }
    shk(lt < 0.1 ? 4 : pull * 1.2);
    z5Cam(1 + 0.05 * eio(lt / 1.4), 0, 240, 140);
  });
  FLASH_CUTS.push(24.0);

  /* 12 — the flick (0:25.4–0:26.6): one finger. The hero is gone — down through the cloud sea, miles of it, tumbling,
     and out under it into the dark ocean world, the sea rushing up */
  const PX4 = 300;
  shot(25.4, 26.6, (lt, t) => {
    const fall = clamp((lt - 0.12) / 1.08, 0, 1);
    if (lt < 0.12) {
      gradient(LB, H - LB, SKY_FIGHT);
      // the finger flicks out; the hero is simply gone along the line of it, a prism streak and a ring left in the air
      const fl_ = eoc(clamp(lt / 0.05, 0, 1));
      sGauntlet(PX4 + 44, 150, 3.4, PI + 0.3, { curls: [lerp(0.48, 0, fl_), 0.95, 0.98, 1], thumb: lerp(0.66, 0.9, fl_), spread: 0 }, 0.8, t);
      const g = lt, hx = 250 - g * 1600, hy = 172 + g * 900;
      for (let q = 0; q < 40; q++) { const u = q / 40; thick(lerp(250, hx, u), lerp(172, hy, u), lerp(250, hx, u) + 1, lerp(172, hy, u), 3, PRISM_C[q % 7]); }
      shockRing(250, 170, 6 + g * 500, 4 + g * 300, 3, [22, 60, 59], 1 - g / 0.12);
      if (g < 0.03) tintAll(T_WH, 0.4);
    } else {
      // falling: the sky, then cloud rushing up past, then the underworld opening below
      const below = sstep(0.45, 0.8, fall);
      if (below < 1) { gradient(LB, H - LB, [101, 102, 13, 14, 19, 20]); for (let k = 0; k < 30; k++) { const y = ((ih(k, 1, 4222) * 400 - fall * 2600 * (0.6 + ih(k, 2, 4222))) % 400 + 400) % 400 - 60; cloudPuff(ih(k, 3, 4222) * W, y, 16 + ih(k, 4, 4222) * 30, k % 3 ? [17, 18, 19, 20] : [14, 15, 19, 20], 4223 + k); } }
      if (below > 0) { belowWorld(t, lerp(330, 150, eoc(below)), 0, 0.3); if (below < 1) tintAll(T_WH, (1 - below) * 0.5); }
      streaks(-PI / 2, 40, t, 3000, below > 0.5 ? 118 : 22, 90, 4224, [0, LB, W, H - 2 * LB]);
      const tumble = lt * 16, hx = 240 + Math.sin(lt * 5) * 12, hy = 130 + Math.sin(lt * 7) * 6;
      z5Zenith(hx, hy, 2.2, t, { sw: -0.4 + Math.sin(lt * 9) * 1.2, ang: tumble, spread: 0.4, flap: 0.6, orbR: 0, auraR: 5, eyes: 'closed', mouth: 2 });
    }
    shk(lt < 0.12 ? 6 : 2.5);
  });
  WHIPS.push([25.45, PI / 2]);

  /* 13 — the sea (0:26.6–0:27.4): it hits the ocean like a falling star: a crater in the water, a wall of sea, spires
     cracking in the shockwave and starting to fall */
  shot(26.6, 27.4, (lt, t) => {
    belowWorld(t, 132, 0, 0.4);
    const CX = 236, CY = 196;
    // the crater: a ring of sea thrown up into a wall, the hole in the middle still dark
    const R = 20 + eoc(clamp(lt / 0.6, 0, 1)) * 150, wall = Math.max(0, 1 - lt / 0.8) * 36;
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const dx = (x - CX) / R, dy = (y - CY) / (R * 0.28), d = Math.sqrt(dx * dx + dy * dy); if (d < 0.85) BUF[y * W + x] = d < 0.5 ? 114 : 115; }
    for (let a = 0; a < TAU; a += 0.015) { const x = CX + Math.cos(a) * R, y0 = CY + Math.sin(a) * R * 0.28, h = wall * (0.6 + 0.4 * vn(a * 6, 0, 1, 4231)); for (let q = 0; q < h; q++) P(x, y0 - q, q > h - 3 ? 119 : q > h * 0.6 ? 118 : 117); }
    rocks(CX, CY - 10, lt, 34, 260, 3, [117, 118, 119, 22], 4232, 300, -PI / 2, 2.4);
    // a spire, near, cracking and toppling away from the blast
    const fallA = eic(clamp((lt - 0.15) / 0.65, 0, 1)) * 0.6;
    for (let q = 0; q < 110; q++) { const along = q, px = 390 + Math.sin(fallA) * along, py = 206 - Math.cos(fallA) * along, w = 14 * (1 - q / 140); thick(px - w / 2, py, px + w / 2, py, 2, q % 23 < 2 ? 103 : q < 60 ? 98 : 99); }
    megaHit(CX, CY - 4, lt, 3, -PI / 2, [22, 118, 117], 4233);
    shk(8 * Math.max(0, 1 - lt / 0.6));
    const [kz, kr] = kick(lt, [[0, 2]]);
    z5Cam(1.05 + kz, kr, CX, 160, 240, 140);
  });
  FLASH_CUTS.push(26.6);

  /* 14 — the combo (0:27.4–0:31): he drops through the clouds behind it like a mountain falling, and then he does not stop.
     Hammer-fist down; uppercut; hook; hook; backhand — each one launches it; between them it tries to guard, too late */
  const CB = [27.6, 28.3, 28.8, 29.3, 29.9], HS4 = 0.067;
  shot(27.4, 31.0, (lt, t) => {
    const tt = i4Stop(t, CB, HS4), MX = 300, MY = 70, s = 1.05;
    belowWorld(t, 150, tt * 20, 0.5);
    // he lands: from above the frame down to his place, the sea thrown up round his base
    const land = eic(clamp((t - 27.4) / 0.22, 0, 1)), my = lerp(-160, MY, land) + (t > 27.62 ? z5Knock(t - 27.62, 6, 10, 5) : 0);
    // the hero's path: in the crater, smashed down, bounced up, launched, flung, flung, flung far
    const P_ = [[27.4, 200, 200], [27.6, 200, 200, 'io'], [27.75, 200, 214, 'o'], [28.2, 208, 176, 'io'], [28.3, 210, 172, 'l'], [28.7, 238, 92, 'o'], [28.8, 236, 92, 'l'], [29.2, 116, 122, 'o'], [29.3, 118, 124, 'l'], [29.75, 262, 150, 'o'], [29.9, 266, 152, 'l'], [30.5, 430, 196, 'o'], [31.0, 420, 192, 'o']];
    const [hx, hy] = i4Path(P_, tt);
    // the fists: each pulled back (wind-up), driven in on its hit, carried through, and drawn back slowly
    const L_ = (x, y) => [(x - MX) / s, (y - my) / s];
    const fistAt = (k, rest, back, hitT) => { const g = tt - hitT; if (g < -0.32 || g > 0.6) return rest; const [hx0, hy0] = L_(...hitPos(k)), dd = Math.hypot(hx0 - back[0], hy0 - back[1]) || 1, px = hx0 - (hx0 - back[0]) / dd * 30, py = hy0 - (hy0 - back[1]) / dd * 30; if (g < -0.1) return lerp2(rest, back, eio((g + 0.32) / 0.22)); if (g < 0) return lerp2(back, [px, py], eic((g + 0.1) / 0.1)); return lerp2([px, py], rest, eio(clamp((g - 0.1) / 0.5, 0, 1))); };
    const lerp2 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    const HP = [[200, 196], [210, 172], [236, 92], [118, 124], [266, 152]];
    const hitPos = (k) => HP[k];
    const A0 = fistAt(0, [-130, 120], [-60, -60], CB[0]), A3 = fistAt(3, A0, [-260, 20], CB[3]);
    const B2 = fistAt(2, [134, 120], [200, 0], CB[2]), D1 = fistAt(1, [96, 196], [60, 240], CB[1]), C4 = fistAt(4, [-96, 196], [40, 160], CB[4]);
    const armUL = tt < 29.0 ? A0 : A3;
    const DX = [0, 0.3, -1, 1, 1];                                  // which way each blow travels (sideways)
    let leanW = 0, nodW = 0; CB.forEach((h, k) => { const g = tt - h; if (g > -0.32 && g < -0.08) { const u = Math.sin(PI * (g + 0.32) / 0.24); leanW -= DX[k] * 9 * u; nodW -= (k === 0 ? 2.5 : 1) * u; } else if (g >= -0.08 && g < 0.6) { const u = g < 0.05 ? eoc((g + 0.08) / 0.13) : Math.exp(-(g - 0.05) * 5); leanW += DX[k] * 12 * u; nodW += (k === 0 ? 3.5 : 1.5) * u; } });
    sunderer(MX, my, s, t, { eyes: 1.3, heat: 0.75, crown: 1, nod: 0.8 + nodW, lean: leanW, tilt: leanW * 0.004,
      arms: [{ x: armUL[0], y: armUL[1], pose: 'fist', fs: 1.9, front: true }, { x: B2[0], y: B2[1], pose: 'fist', fs: 1.9, front: tt > 28.5 && tt < 29.1 }, { x: C4[0], y: C4[1], pose: tt > 29.6 && tt < 30.3 ? 'open' : 'fist', fs: 1.9, front: tt > 29.6 && tt < 30.3, ang: tt > 29.6 && tt < 30.3 ? PI * 0.15 : undefined }, { x: D1[0], y: D1[1], pose: 'fist', fs: 1.9, front: tt > 28.0 && tt < 28.6 }] });
    // the sea where he stands
    if (land > 0.9) rocks(MX, 230, t - 27.62, 30, 240, 3, [117, 118, 119, 22], 4241, 280, -PI / 2, 2.6);
    // the hero: guard thrown up as each blow comes (too late), then the blow: tumbling, wings crumpling
    const guard = CB.reduce((m, h) => Math.max(m, sstep(h - 0.2, h - 0.05, tt) * (1 - sstep(h, h + 0.02, tt))), 0);
    const spin = CB.reduce((a, h, k) => a + (tt > h ? (k % 2 ? -1 : 1) * 4.5 * eoc(clamp((tt - h) / 0.5, 0, 1)) : 0), 0);
    const squash = CB.reduce((m, h) => { const g = t - h; return g >= 0 && g < 0.25 ? Math.max(m, Math.exp(-g * 14)) : m; }, 0);
    z5Zenith(hx, hy, 1.15, t, { sq: 0.45 * squash, sw: guard > 0.2 ? -1.6 : -0.3 + Math.sin(tt * 7) * 0.8, ang: spin + guard * -0.2, spread: 0.45 + 0.2 * guard, flap: 0.5, orbR: 0, auraR: 4, sparks: 4, eyes: guard > 0.2 ? 'wide' : 'closed', mouth: guard > 0.2 ? 1 : 2, sq: guard * 0.2 });
    // the blows
    CB.forEach((h, k) => { const dir = [PI / 2, -PI / 2 - 0.3, PI - 0.3, 0.2, 0.15][k]; megaHit(HP[k][0], HP[k][1], t - h, k === 0 || k === 4 ? 2.6 : 2, dir, [22, 105, 103], 4242 + k); });
    // the backhand drags the hero across the sea: a trail of spray
    if (tt > 29.9) for (let q = 0; q < 14; q++) { const [px, py] = i4Path(P_, tt - q * 0.03); if (py > 185) rocks(px, py + 4, 0.1 + q * 0.02, 3, 80, 2, [118, 119, 117, 22], 4247 + q, 200, -PI / 2, 1.5); }
    const [kz, kr, kx, ky] = kick(t, CB.map((h, k) => [h, k === 0 || k === 4 ? 1.6 : 1.1, [PI / 2, -PI / 2, PI, 0, 0][k]]));
    shk(CB.some((h) => t > h && t < h + 0.2) ? 7 : 1.5);
    z5Cam(1.12 + kz, kr, lerp(250, hx, 0.45) - kx, lerp(140, hy, 0.35) - ky, 240, 140);
  });

  /* 15 — dragged (0:31–0:33): it is in his fist; the fist goes through a spire, and another, and another */
  const SP15 = [31.6, 32.1, 32.6];
  shot(31.0, 33.0, (lt, t) => {
    const pan = lt * 520;
    belowWorld(t, 140, pan, 0.6);
    const FX = 210 + z5Sh(t, 3) * 3, FY = 150 + Math.sin(lt * 4) * 6;
    // spires in the near ground rushing past right to left; each is hit and bursts
    SP15.forEach((h, k) => {
      const x = FX + (h - t) * 520, g = t - h;
      if (g < 0) { for (let q = 0; q < 150; q++) { const w = 26 * (1 - q / 190); thick(x - w / 2, 230 - q, x + w / 2, 230 - q, 2, q % 31 < 2 ? 102 : q < 70 ? 98 : 99); } }
      else { rocks(FX + 20, FY, g, 40, 340, 6, [97, 98, 99, 103], 4251 + k, 220, PI + 0.2, 1.6); megaHit(FX + 10, FY, g, 1.6, PI, [22, 105, 103], 4254 + k); }
    });
    // the arm, from off the right, and the fist with the hero crushed in it (a wing and the head showing)
    capsF(FX + 30, FY, W + 120, FY - 60, 18, 26, (u, d, X, Y, nx) => d > 0.84 ? 96 : OBS[clamp(fl(2 - nx * 1.6 + (bay(X, Y) - 0.5)), 0, 4)]);
    const sqz = 0.75 + 0.1 * Math.sin(t * 9) + SP15.reduce((m, h) => m + (t > h && t < h + 0.25 ? 0.15 * Math.exp(-(t - h) * 10) : 0), 0);
    sGauntlet(FX + 30, FY, 2.2, PI, { curl: sqz, thumb: 0.7, spread: 0.1 }, 0.8, t, { hold: () => {
      z5Wings(FX - 8, FY - 22, 0.9, t * 3, 0.32 + 0.08 * Math.sin(t * 7), 0.7);
      actor(HERO3({ form: 'zenith', eyes: 'closed', mouth: 2, sword: null, sq: 0.25 + 0.1 * Math.sin(t * 9), cracks: 0.2 }), FX - 10, FY - 4, 1.7, -0.6 + z5Sh(t, 5) * 0.2, false, { still: true });
    } });
    streaks(0, 30, t, 2600, 121, 60, 4257, [0, LB, W, H - 2 * LB]);
    shk(4);
    const [kz, kr] = kick(t, SP15.map((h) => [h, 1.2]));
    z5Cam(1.05 + kz, kr, 230, 140, 240, 135);
  });

  /* 16 — the slam (0:33–0:33.5): down onto the stump of a spire, which explodes */
  shot(33.0, 33.5, (lt, t) => {
    belowWorld(t, 120, 900, 0.7);
    const FX = 240, FY = lerp(80, 186, eic(clamp(lt / 0.06, 0, 1)));
    for (let q = 0; q < 50; q++) { const w = 70 * (1 - q / 90); thick(FX - w / 2, 240 - q, FX + w / 2, 240 - q, 2, q % 19 < 2 ? 103 : 98); }
    capsF(FX, FY - 20, FX + 90, LB - 40, 22, 30, (u, d, X, Y, nx) => d > 0.84 ? 96 : OBS[clamp(fl(2 - nx * 1.6 + (bay(X, Y) - 0.5)), 0, 4)]);
    sGauntlet(FX + 10, FY - 30, 2.6, PI / 2 + 0.15, lt < 0.12 ? 'fist' : 'open', 0.9, t);
    if (lt > 0.1) actor(HERO3({ form: 'zenith', eyes: 'closed', mouth: 2, sword: -0.3 }), FX - 40 - lt * 60, 200 - Math.sin(lt * 6) * 30, 1.8, lt * 9, false);
    rocks(FX, 210, lt, 60, 380, 7, [97, 98, 99, 104], 4261, 260, -PI / 2, 2.8);
    megaHit(FX, 205, lt, 3, -PI / 2, [22, 105, 103], 4262);
    shk(9 * Math.max(0, 1 - lt / 0.4));
    z5Cam(1.08 + kick(lt, [[0, 2]])[0], 0, 240, 160, 240, 140);
  });
  FLASH_CUTS.push(33.0);

  /* 17 — it gets up (0:33.5–0:36): in the shallows on the rubble, wings torn. It swings, twice, with everything; a palm
     stops both, and does not move */
  shot(33.5, 36.0, (lt, t) => {
    belowWorld(t, 150, 920, 0.8);
    rocks(240, 230, 1.2, 30, 10, 6, [97, 98, 99, 121], 4271, 0, 0, TAU);
    const PX = 380, PY = 146;                                   // the palm
    const rise = eio(clamp(lt / 0.7, 0, 1)), pant = Math.sin(t * 5) * 0.06;
    const S1 = 34.4, S2 = 35.2, g1 = t - S1, g2 = t - S2;
    let hx = lerp(150, 230, eio(clamp((lt - 0.4) / 0.5, 0, 1))), hy = lerp(214, 170, rise), sw = -0.5, ang = 0.1;
    // swing one: a horizontal cleave; swing two: an overhead with the last of its strength; each bounces off the palm
    if (g1 > -0.35 && g1 < 0.5) { sw = g1 < -0.08 ? lerp(-0.5, -2.7, eio((g1 + 0.35) / 0.27)) : g1 < 0 ? lerp(-2.7, 0.6, eic((g1 + 0.08) / 0.08)) : lerp(0.6, -0.4, eoc(clamp(g1 / 0.4, 0, 1))); hx += g1 > 0 ? -18 * eoc(clamp(g1 / 0.2, 0, 1)) : 26 * eic(clamp((g1 + 0.2) / 0.2, 0, 1)); }
    if (g2 > -0.4 && g2 < 0.8) { sw = g2 < -0.1 ? lerp(-0.4, -3.0, eio((g2 + 0.4) / 0.3)) : g2 < 0 ? lerp(-3.0, 0.9, eic((g2 + 0.1) / 0.1)) : lerp(0.9, 0.2, eoc(clamp(g2 / 0.5, 0, 1))); hx += g2 > 0 ? -30 * eoc(clamp(g2 / 0.25, 0, 1)) : 28 * eic(clamp((g2 + 0.2) / 0.2, 0, 1)); hy += g2 > 0 ? 34 * eoc(clamp(g2 / 0.5, 0, 1)) : 0; ang = g2 > 0 ? -0.5 * eoc(clamp(g2 / 0.4, 0, 1)) : ang; }
    z5Wings(hx - 4, hy - 12, 1.2, t * 1.6, 0.5 + 0.1 * Math.sin(t * 3), 0.4);
    // tears in the wings: gaps burned through them
    for (let k = 0; k < 9; k++) discF(hx - 40 + ih(k, 1, 4272) * 80, hy - 30 - ih(k, 2, 4272) * 40, 3 + ih(k, 3, 4272) * 3, k % 3 ? 98 : 121);
    actor(HERO3({ form: 'zenith', eyes: g2 > 0 ? 'closed' : 'angry', mouth: (g1 > -0.1 && g1 < 0.2) || (g2 > -0.12 && g2 < 0.25) ? 2 : 1, sword: sw, swordCols: z5Sw(t), sq: pant + (rise < 1 ? 0.2 * (1 - rise) : 0), cracks: 0.25 }), hx, hy, 2.4, ang, false);
    aura(t, ZEN_AURA, 6, { sparks: 4 });
    // the palm: immense, still; on the second blow its fingers close a little
    const curl = sstep(S2 + 0.05, S2 + 0.5, t);
    sGauntlet(PX + 60, PY + 10, 3.6, PI, { curl: 0.08 + 0.06 * Math.sin(t * 1.7) + curl * 0.45, thumb: 0.08 + curl * 0.3, spread: 0.85 - curl * 0.4 }, 0.7, t);
    [S1, S2].forEach((h, k) => { const g = t - h; if (g >= 0 && g < 0.35) { i4Skid(PX - 6, PY - 6 + k * 14, g, PI + 0.4 - k * 0.8, 26, 4273 + k); shockRing(PX - 6, PY, 4 + g * 160, 4 + g * 160, 2, [22, 60, 59], 1 - g / 0.3); } });
    shk((g1 > 0 && g1 < 0.2) || (g2 > 0 && g2 < 0.25) ? 3 : 0.5);
    z5Cam(1.08, 0.01 * z5N(t * 0.4, 2), 270, 150, 240, 140);
  });

  /* 18 — WEIGHT (0:36–0:38.2): his palm presses down from above, and everything under it is pressed with it: the sea into a
     crater, the light bent, the hero driven down on its knees, its wings bent to breaking */
  shot(36.0, 38.2, (lt, t) => {
    belowWorld(t, 120, 930, 0.6);
    const CX = 240, CY = 196, press = eic(clamp(lt / 2.2, 0, 1)), pz = sstep(0, 0.3, lt);
    // the sea pressed into a bowl: dark rings sinking
    for (let k = 0; k < 6; k++) { const r = (30 + k * 26) * (0.6 + 0.4 * press) + frac(t * 1.5 + k / 6) * 10; ring(CX, CY + 8, r, r * 0.26, k % 2 ? 114 : 115); }
    for (let y = CY - 8; y < H - LB; y++) for (let x = CX - 110; x < CX + 110; x++) { const dx = (x - CX) / 110, dy = (y - CY - 8) / 30, d = dx * dx + dy * dy; if (d < 1 && d > 0) tintP(x, y, T_DEEP, 0.6 * press * (1 - d)); }
    const hy = CY - 18 + press * 16, wing = 0.55 - 0.35 * press;
    z5Wings(CX, hy - 16 + press * 6, 1.3, t * 2, wing, 0.1);
    actor(HERO3({ form: 'zenith', eyes: lt > 0.6 ? 'closed' : 'wide', mouth: lt > 0.4 ? 2 : 1, sword: 0.6 + press * 0.6, swordCols: z5Sw(t), sq: 0.15 + press * 0.45, cracks: 0.25 + press * 0.45, legs: [2, 2, 2, 2] }), CX, hy, 2.6, 0, false, { still: true });
    aura(t, ZEN_AURA, 6 + z5Sh(t, 2) * 2, { sparks: 6 });
    // the palm, enormous, face down, coming down out of the top of the frame
    const tips = sGauntlet(CX + 10, lerp(-40, 30, eoc(pz)) + press * 26, 5.2, PI / 2, { curl: 0.12 - press * 0.12, thumb: 0.05, spread: 0.7 + press * 0.3 }, 0.9, t);
    if (press > 0.3) for (let k = 0; k < 7; k++) { const a = -PI + (k + 0.5) / 7 * PI, L = 30 + press * 60 * (0.6 + ih(k, 1, 4283) * 0.6); let x = CX + Math.cos(a) * 34, y = CY + 12 + Math.sin(a) * -6; for (let q = 0; q < 6; q++) { const nx = x + Math.cos(a) * L / 6 + (ih(k, q, 4284) - 0.5) * 6, ny = y + Math.sin(a) * -L / 36; lineP(x, y, nx, ny, q < 2 && press > 0.7 ? 104 : 96); x = nx; y = ny; } }
    // the pressure itself: the air dragged downward, the picture bent toward the ground
    streaks(PI / 2, 50, t, 2000, 121, 50, 4281, [0, LB, W, H - 2 * LB]);
    warp(CX, CY - 10, 200, 0.18 + 0.32 * press, 1.4);
    for (let k = 0; k < 20; k++) { const a = -PI + ih(k, 1, 4282) * PI, g = frac(t * 2 + ih(k, 2, 4282)); P(CX + Math.cos(a) * (60 + g * 140), CY + 10 + Math.sin(a) * -(4 + g * 6), 119); }
    shk(2 + press * 5);
    z5Cam(1.05 + 0.1 * press, 0.01 * z5Sh(t, 7) * press, CX, CY - 30, 240, 150);
  });

  /* 19 — Zenith breaks (0:38.2–0:39): the wings burst into prism shards; the light goes out of it; plain coral, falling */
  shot(38.2, 39.0, (lt, t) => {
    belowWorld(t, 120, 930, 0.6);
    const CX = 240, CY = 196;
    rocks(CX, CY - 30, lt, 70, 420, 4, [84, 85, 86, 22], 4291, 260, -PI / 2, PI * 1.3);
    rocks(CX, CY - 30, lt, 40, 300, 3, [81, 82, 83, 22], 4292, 260, -PI / 2, PI * 1.6);
    actor(HERO3({ eyes: 'closed', mouth: 0, sword: 0.9, swordCols: z5Sw(t * 0.2), sq: 0.5 - 0.3 * eoc(clamp(lt / 0.4, 0, 1)), cracks: 0.55, legs: [3, 3, 3, 3] }), CX, CY - 4 + lt * 6, 2.6, 0.2 * eoc(lt), false, { still: true });
    if (lt < 0.034) tintAll(T_WH, 0.55);
    megaHit(CX, CY - 20, lt, 2, -PI / 2, [22, 84, 86], 4293);
    shk(6 * Math.max(0, 1 - lt / 0.5));
    z5Cam(1.15, 0, CX, CY - 30, 240, 150);
  });
  FLASH_CUTS.push(38.2);

  /* 20 — "Is that all?" (0:39–0:41.2): from the ground behind the fallen hero, up at him: he lifts a fist over it, high, higher;
     it comes down at us; the frame breaks */
  shot(39.0, 41.2, (lt, t) => {
    gradient(LB, H - LB, [96, 97, 98, 101]);
    const raise = eio(clamp(lt / 1.4, 0, 1)), wind = eio(lin(1.4, 1.8, lt)), down = eic(clamp((lt - 1.8) / 0.2, 0, 1)), hit = lt >= 2.0;
    const fx = lerp(-40, -96, raise) + wind * -16, fy = lerp(80, -40, raise) - wind * 22;
    sunderer(262, 84, 1.45, t, { eyes: 1.4 + down * 0.5, heat: 0.8, crown: 1, nod: 1.5, rage: 0.3 * wind, arms: [down > 0 ? null : { x: fx, y: fy, pose: 'fist', front: true }, { x: 140, y: 110, pose: 'fist' }, { x: -100, y: 200, pose: 'open' }, { x: 100, y: 200, pose: 'open' }] });
    belowWorldFore(t);
    actor(HERO3({ eyes: 'closed', sword: 1.2, swordCols: z5Sw(t * 0.2), cracks: 0.55, legs: [3, 2, 3, 3] }), 150, 222, 3.0, 0.25, false, { still: true });
    if (down > 0 && !hit) { const sc = lerp(1.6, 9, down * down); sGauntlet(lerp(150, 250, down), lerp(-60, 150, down), sc, PI / 2 + 0.3, 'fist', 1, t); }
    if (hit) { const g = lt - 2.0; rectF(0, LB, W, H - 2 * LB, 96); sGauntlet(250, 135, 9, PI / 2 + 0.3, 'fist', 1, t); frameCrack(250, 135, clamp(g / 0.15, 0, 1), 4301); if (g < 0.034) impactFrame(250, 135, 1); tintAll(T_DARK, sstep(0.12, 0.2, g)); }
    shk(hit ? 10 : wind * 2);
  });
  function belowWorldFore(t) { for (let y = 210; y < H - LB; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = ((x + y) & 3) === 0 ? 115 : 114; for (let k = 0; k < 8; k++) ring(80 + k * 50, 222, 20, 3, 116); }
  FLASH_CUTS.push(41.0);
  CAPS.push([39.2, 40.9, 's', 'SUNDERER', 'IS THAT ALL?']);

  }

  /* ================================================================ part IV, act III (0:41–0:58): beyond */
  {
  const NOVA_AURA = [110, 109, 108, 22], WOUND1 = [-60, 58, 44, 112, 3.5], WOUND2 = [70, 34, 92, 52, 4];
  // wings like z5Wings but in any colours: flame for nova (three ranks: outer flames cycling, gold, white-hot)
  function i4Wings(x, y, s, t, spread, flap, P3, T) {
    if (spread <= 0.02) return;
    const amp = flap === undefined ? 0.24 : flap, sh = fl(t * 12);
    glow(x, y - 8 * s, 80 * s * spread, T || T_NOVA, 0.4 * spread);
    for (const sd of [-1, 1]) {
      const beat = z5Beat(t) * amp, arm = -0.78 - beat + (1 - spread) * 1.3, ax = Math.cos(arm) * sd, ay = Math.sin(arm), Lw = 44 * s * (0.35 + 0.65 * spread);
      for (const [N, len, rank] of [[10, 1, 0], [8, 0.62, 1], [7, 0.36, 2]]) for (let j = N - 1; j >= 0; j--) {
        const u = (j + 0.6) / N, bx = x + ax * Lw * u, by = y + ay * Lw * u - Math.sin(u * PI) * 5 * s;
        const bu = z5Beat(t - 0.12 * u) * amp, fr = lerp(PI / 2 - 0.12, -0.15 - bu * 1.5, Math.pow(u, 1.25)) - (1 - spread) * 0.5, fa = sd > 0 ? fr : PI - fr;
        const fl_ = 1 + 0.12 * Math.sin(t * 23 + j * 1.7 + rank), L = s * (15 + 32 * u) * len * (0.45 + 0.55 * spread) * fl_, w = s * (4.6 - rank * 0.8);
        const fill = rank === 0 ? P3[0][(j + sh) % P3[0].length] : P3[1], rim = rank === 0 ? P3[2] : rank === 1 ? P3[0][0] : P3[1];
        z5Kite(bx - Math.cos(fa) * 1.2, by - Math.sin(fa) * 1.2, fa, L + 2.4, w + 1.1, rim);
        z5Kite(bx, by, fa, L, w, rank === 2 ? 22 : fill);
      }
    }
  }
  const NOVA_W = [[104, 105, 106, 105], 108, 107];
  // the hero in Zenith Nova: flame wings, the white-hot star body, a corona; returns the actor's { hand, tip }
  function i4Nova(x, y, S, t, o) {
    o = o || {};
    const wt = o.wt === undefined ? t * 1.3 : o.wt, sp = o.spread === undefined ? 1 : o.spread, bob = z5Bob(wt, S, o.flap || 0.3) * sp, ang = o.ang || 0;
    glow(x, y, 26 * S, T_NOVA, 0.45);
    i4Wings(x - Math.sin(ang) * 6 * S, y + bob - Math.cos(ang) * 6 * S, S * 0.62, wt, sp, o.flap || 0.3, NOVA_W);
    const a = actor(HERO3({ form: 'nova', eyes: o.eyes || 'glow', mouth: o.mouth, sword: o.sw === undefined ? null : o.sw, swordCols: [105, 106, 107, 106], sq: o.sq, flip: o.flip, cracks: o.cracks }), x, y, S, ang, !!o.flip, { bob, white: o.white, noSmear: o.noSmear });
    aura(t, NOVA_AURA, o.auraR || 4 * S, { sparks: o.sparks === undefined ? 16 : o.sparks, rise: 0.6 });
    return a;
  }
  const SKY_DARK = [96, 97, 98, 101];

  /* 21 — in the crater (0:41.2–0:44.5): near black. The sea filling back in; the hero half sunk in it, still; the four orbs
     barely alight, circling slowly. A trembling hand closes on the sword. "...not... yet..." */
  shot(41.2, 44.5, (lt, t) => {
    belowWorld(t, 120, 930, 0.2);
    tintAll(T_DARK, 0.6);
    const HX = 240, HY = 200, grip = eio(lin(2.2, 3.2, lt));
    for (let k = 0; k < 5; k++) { const r = 30 + k * 30 + frac(t * 0.3 + k * 0.2) * 30; ring(HX, HY + 8, r, r * 0.22, 115); }
    actor(HERO3({ eyes: lt > 1.4 && lt < 1.55 ? 'narrow' : 'closed', sword: lerp(0.9, 0.4, grip) + z5Sh(t, 3) * 0.05 * grip, swordCols: z5Sw(t * 0.2), cracks: 0.55, legs: [3, 3, 3, 3], sq: Math.sin(t * 1.6) * 0.04 }), HX, HY - 6, 3.0, 0.12, false, { still: true });
    // the water over its lower half
    for (let y = HY + 2; y < H - LB; y++) for (let x = HX - 70; x < HX + 70; x++) { const d = Math.abs(x - HX) / 70; if (y > HY + 2 + Math.sin(x * 0.2 + t * 2) * 1.5 + d * 4) { BUF[y * W + x] = (x + y) % 5 === 0 ? 116 : 115; tintI(y * W + x, x, y, T_DARK, 0.6 + d * 0.1); } }
    // the orbs, guttering
    for (let k = 0; k < 4; k++) { const a = t * 0.6 + k * TAU / 4, fl_ = 0.6 + 0.4 * Math.sin(t * 7 + k * 2); if (ih(k, fl(t * 10), 4401) < 0.85) orbAt(HX + Math.cos(a) * 34, HY - 10 + Math.sin(a) * 9, k, 2 * fl_, t); }
    for (let k = 0; k < 14; k++) { const g = frac(t * 0.12 + ih(k, 1, 4402)); P(HX - 120 + ih(k, 2, 4402) * 240, HY - g * 120, 121); }
    z5Cam(1.25 + 0.08 * eio(lt / 3.3), 0, HX, HY - 20, 240, 150);
    if (lt < 0.8) tintAll(T_DARK, 1 - eio(lt / 0.8));
  });
  CAPS.push([42.6, 44.4, 's', 'HERO', '...NOT... YET...']);

  /* 22 — the orbs come in (0:44.5–0:46): they flare, and dive into it one after another; the sea boils away round it;
     it rises out of the water, curls in on itself — gathering */
  shot(44.5, 46.0, (lt, t) => {
    belowWorld(t, 120, 930, 0.2);
    tintAll(T_DARK, 0.6 * (1 - sstep(0.4, 1.4, lt)));
    const HX = 240, rise = eio(lin(0.3, 1.2, lt)), HY = 194 - rise * 14 + z5Sh(t, 2) * 1.5 * rise, curl = sstep(1.15, 1.45, lt);
    // the sea pushed back: a ring of boiling water, steam
    const R = 30 + eio(clamp(lt / 1.5, 0, 1)) * 90;
    for (let a = 0; a < TAU; a += 0.02) { const x = HX + Math.cos(a) * R, y = HY + 14 + Math.sin(a) * R * 0.24; for (let q = 0; q < 6; q++) P(x, y - q, q > 4 ? 119 : 117); }
    for (let k = 0; k < 30; k++) { const g = frac(t * 0.8 + ih(k, 1, 4411)), a = ih(k, 2, 4411) * TAU, r = R * (0.3 + ih(k, 3, 4411) * 0.7); cloudPuff(HX + Math.cos(a) * r, HY + 14 + Math.sin(a) * r * 0.24 - g * 40, 3 + g * 6, [19, 20, 21, 22], 4412 + k); }
    glow(HX, HY, 40 + lt * 80, T_NOVA, 0.3 + lt * 0.3);
    actor(HERO3({ eyes: lt > 0.8 ? 'angry' : 'closed', mouth: lt > 1.2 ? 2 : 0, sword: lerp(0.4, -1.6, eio(clamp((lt - 0.6) / 0.6, 0, 1))), swordCols: z5Sw(t), cracks: 0.55 * (1 - sstep(0.5, 1.3, lt)), sq: 0.35 * curl, legs: rise > 0.5 ? undefined : [3, 3, 3, 3] }), HX, HY + curl * 4, 3.0, 0, false);
    // the orbs flare and dive in, each on its own spiral
    for (let k = 0; k < 4; k++) {
      const st = 0.15 + k * 0.22, u = eic(clamp((lt - st) / 0.55, 0, 1)); if (u >= 1) { const g = lt - st - 0.55; if (g < 0.2) glow(HX, HY, 50, EL_T[k], 0.7 * (1 - g / 0.2)); continue; }
      const a = t * 0.6 + k * TAU / 4 + u * 5, r = 34 * (1 - u), x = HX + Math.cos(a) * r, y = HY - 10 + Math.sin(a) * r * 0.5 - Math.sin(u * PI) * 20;
      for (let q = 1; q < 8; q++) { const u2 = eic(clamp((lt - st - q * 0.025) / 0.55, 0, 1)), a2 = t * 0.6 + k * TAU / 4 + u2 * 5, r2 = 34 * (1 - u2); rectF(HX + Math.cos(a2) * r2 - 1, HY - 10 + Math.sin(a2) * r2 * 0.5 - Math.sin(u2 * PI) * 20 - 1, 2, 2, ORB[k][q < 3 ? 2 : 1]); }
      orbAt(x, y, k, 2 + 4 * Math.min(1, lt * 2), t);
    }
    shk(1 + lt * 3);
    z5Cam(1.25 + 0.1 * eio(lt / 1.5), 0, HX, HY - 20, 240, 150);
  });

  /* 23 — ZENITH NOVA (0:46–0:47.6): a star goes off in the sea. White-hot, molten, flame for wings — and the sword GROWS:
     the blade racing out of the hilt up into the sky, ten times its length; then raised, back, back, for the stroke */
  shot(46.0, 47.6, (lt, t) => {
    belowWorld(t, 150, 930, 0.6);
    const HX = 240, HY = 190, g = lt;
    z5Sunburst(HX, HY, 16, t * 0.5, 30, 320 * eoc(clamp(g / 0.3, 0, 1)), 0.07, [104, 105, 106, 107, 108, 22]);
    // the sea flattened in a ring
    const R = 20 + eoc(clamp(g / 0.5, 0, 1)) * 300;
    for (let a = 0; a < TAU; a += 0.012) { const x = HX + Math.cos(a) * R, y = HY + 18 + Math.sin(a) * R * 0.2; for (let q = 0; q < 8 * (1 - g / 1.6); q++) P(x, y - q, q > 5 ? 22 : 119); }
    // the growth: out it races, up into the sky (0.2–1.0); then cocked back for the stroke (1.15–1.6)
    const grow = eoc(clamp((g - 0.45) / 0.65, 0, 1)), cock = eio(lin(1.18, 1.6, g));
    const swA = -PI / 2 + 0.18 - cock * 0.9;
    const a = i4Nova(HX, HY - 6 * eob(clamp(g / 0.4, 0, 1)), 2.6, t, { sw: swA, spread: eob(clamp(g / 0.4, 0, 1)), flap: 0.4, mouth: g < 0.6 ? 2 : 1, noSmear: true, sq: -0.1 * cock });
    if (grow > 0) {
      const tip = bigBlade(a.hand[0], a.hand[1], swA, 640, 5.5, t, { form: 'nova', grow, flare: 0.8, surge: true });
      for (let k = 0; k < 4; k++) { const f = frac(g * 2 + k / 4) * grow; shockRing(a.hand[0] + Math.cos(swA) * 640 * f, a.hand[1] + Math.sin(swA) * 640 * f, 14 * (1 - f) + 4, 6 * (1 - f) + 2, 2, [22, 108, 105], 1 - f); }
    }
    if (g < 0.03) impactFrame(HX, HY, 0);
    if (g < 0.2) tintAll(T_NOVA, 0.5 * (1 - g / 0.2));
    shk(g < 0.6 ? 7 * (1 - g / 0.6) : 2);
    // the camera is thrown back by it, and climbs the blade
    const pull = eoc(clamp(g / 1.0, 0, 1));
    z5Cam(lerp(1.35, 0.95, pull) + kick(g, [[0, 2]])[0], 0, HX, lerp(HY - 20, HY - 60, pull), 240, lerp(150, 175, pull));
  });
  FLASH_CUTS.push(46.0);
  CAPS.push([46.0, 46.85, 'x', '', 'ZENITH...', 92], [46.3, 46.85, 'x', '', 'NOVA!', 140]);

  /* the giant-blade fight, in one wide frame: the hero left, him right, the blade across the frame between them.
     BK: blade angle keys [time, angle, ease]; his body pushed back further with each blow that lands */
  function i4BladeFight(t, o) {
    belowWorld(t, 150, 930 + (o.pan || 0), 0.75);
    const S = 1.7, hx = o.hx, hy = o.hy;
    const sx = o.sx, sy = o.sy, ss = o.ss;
    const so = sunderer(sx, sy, ss, t, o.sun);
    const a = i4Nova(hx, hy, S, t, { sw: o.swA, spread: o.spread === undefined ? 1 : o.spread, flap: 0.4, mouth: o.mouth || 1, noSmear: true, ang: o.ang || 0 });
    const tip = bigBlade(a.hand[0], a.hand[1], o.swA, o.len || 430, 4.4, t, { form: 'nova', flare: 0.7, surge: true });
    if (o.trail) for (let q = 1; q <= 5; q++) { const aa = o.trail(q * 0.016); if (aa === undefined) continue; for (let r = 40; r < (o.len || 430); r += 3) P(a.hand[0] + Math.cos(aa) * r, a.hand[1] + Math.sin(aa) * r, q < 2 ? 108 : q < 4 ? 109 : 110); }
    return { a, so, tip };
  }

  /* 24 — the first blow that matters (0:47.6–0:48.4): the giant blade comes down; he blocks it with crossed arms — and for
     the first time he moves: shoved back, ploughing the sea; the stroke's force runs on past him, cleaving the sea in a line
     to the horizon */
  shot(47.6, 48.4, (lt, t) => {
    const back = eoc(clamp(lt / 0.5, 0, 1)) * 46, swA = lerp(-1.5, 0.12, eic(clamp(lt / 0.04, 0, 1)));
    const { so } = i4BladeFight(t, { hx: 100, hy: 176, swA, sx: 330 + back, sy: 82, ss: 0.95,
      sun: { eyes: 1.5, heat: 0.8, crown: 1, rage: 0.2, nod: 1, arms: [{ x: 30, y: 30, pose: 'fist', front: true, ang: -0.6 }, { x: -30, y: 36, pose: 'fist', front: true, ang: -2.4 }, { x: -96, y: 196, pose: 'open' }, { x: 96, y: 196, pose: 'open' }] },
      trail: (d) => lt - d < 0.04 ? lerp(-1.5, 0.12, eic(clamp((lt - d) / 0.04, 0, 1))) : undefined });
    // the cleave runs on: a trench torn in the sea from his feet to the horizon, walls of water either side
    const run = eoc(clamp(lt / 0.35, 0, 1));
    for (let q = 0; q < 120 * run; q++) { const u = q / 120, x = lerp(330 + back, 470, u), y = lerp(250, 152, u), h = (1 - u) * 26 * (1 - lt / 0.8); for (let k = 0; k < h; k++) { P(x - 6 * (1 - u), y - k, k > h - 3 ? 22 : 119); P(x + 6 * (1 - u), y - k, k > h - 3 ? 22 : 118); } P(x, y, 22); }
    // the wake behind him: the sea ploughed up
    rocks(330 + back + 40, 240, lt, 40, 220, 3, [117, 118, 119, 22], 4441, 260, -PI / 2 + 0.6, 1.4);
    megaHit(332 + back * 0.5, 130, lt, 2.4, 0.3, [22, 108, 105], 4442); if (lt < 0.5) frameCrack(332, 130, clamp(lt * 4, 0, 0.5) * (1 - sstep(0.3, 0.5, lt)), 4443, 90);
    shk(8 * Math.max(0, 1 - lt / 0.6));
    const [kz, kr, kx, ky] = kick(lt, [[0, 2, 0.2]]);
    z5Cam(1.04 + kz, kr, 250 - kx, 140 - ky, 240, 140);
  });
  FLASH_CUTS.push(47.6);

  /* 25 — the giant blade, again and again (0:48.4–0:50.4): a sweep from the left, a rising cut, an overhead; he blocks each
     with a different arm, and gives ground with every one */
  const GB = [48.6, 49.2, 49.8];
  shot(48.4, 50.4, (lt, t) => {
    const keys = [[48.4, 0.12], [48.45, 0.4], [48.56, -1.25, 'io'], [48.6, 0.55, 'i'], [48.9, 0.7, 'o'], [49.12, 1.25, 'io'], [49.2, -0.75, 'i'], [49.5, -1.0, 'o'], [49.7, -2.2, 'io'], [49.8, 0.25, 'i'], [50.4, 0.3, 'o']];
    const angAt = (tt) => { if (tt <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (tt < keys[i][0]) { const [t0, a0] = keys[i - 1], [t1, a1, e] = keys[i], u = (tt - t0) / (t1 - t0); return lerp(a0, a1, e === 'i' ? eic(u) : e === 'o' ? eoc(u) : eio(u)); } return keys[keys.length - 1][1]; };
    const swA = angAt(t), back = GB.reduce((s_, h) => s_ + (t > h ? 14 * eoc(clamp((t - h) / 0.3, 0, 1)) : 0), 46);
    // blocks: lower-left takes the sweep, upper-right the rising cut, the crossed upper pair the overhead
    const blk = (h) => sstep(h - 0.2, h - 0.05, t) * (1 - sstep(h + 0.3, h + 0.5, t));
    const b1 = blk(GB[0]), b2 = blk(GB[1]), b3 = blk(GB[2]);
    const hx = 100 + 10 * Math.sin(t * 2), hy = 176 - b3 * 10;
    i4BladeFight(t, { hx, hy, swA, pan: lt * 30, sx: 330 + back, sy: 82, ss: 0.95, ang: (swA > 0 ? 0.15 : -0.15),
      sun: { eyes: 1.5, heat: 0.85, crown: 1, rage: 0.25, nod: 1,
        arms: [{ x: lerp(-130, 0, b3), y: lerp(124, -10, b3), pose: 'fist', front: b3 > 0.1, ang: b3 > 0.1 ? -0.8 : undefined }, { x: lerp(132, -40, Math.max(b2, b3)), y: lerp(124, lerp(150, -4, b3 / Math.max(0.01, Math.max(b2, b3))), Math.max(b2, b3)), pose: 'fist', front: Math.max(b2, b3) > 0.1 }, { x: lerp(-96, -150, b1), y: lerp(196, 130, b1), pose: b1 > 0.3 ? 'open' : 'fist', front: b1 > 0.1 }, { x: 96, y: 196, pose: 'open' }] },
      trail: (d) => angAt(t - d) });
    const CP = [[300, 150], [300, 196], [318, 100]];
    GB.forEach((h, k) => megaHit(CP[k][0] + back - 46, CP[k][1], t - h, 2.2, [PI, PI / 2 + 0.5, -PI / 2 - 0.2][k] + PI, [22, 108, 105], 4451 + k));
    const [kz, kr, kx, ky] = kick(t, GB.map((h, k) => [h, 1.3, k * 1.3]));
    shk(GB.some((h) => t > h && t < h + 0.25) ? 6 : 1.5);
    z5Cam(1.04 + kz, kr, 260 - kx, 140 - ky, 240, 140);
  });

  /* 26 — it gets through (0:50.4–0:51.4): a diagonal stroke past his guard; a burning wound opens across his chest; he
     staggers back — and for the first time, something in the mask that might be pain */
  shot(50.4, 51.4, (lt, t) => {
    belowWorld(t, 130, 960, 0.8);
    const h = 0.2, g = lt - h, cut = eoc(clamp(g / 0.08, 0, 1)), stag = g > 0 ? eoc(clamp(g / 0.45, 0, 1)) : 0;
    const W1 = [WOUND1[0], WOUND1[1], lerp(WOUND1[0], WOUND1[2], cut), lerp(WOUND1[1], WOUND1[3], cut), WOUND1[4]];
    const so = sunderer(300 + stag * 24, 70 - stag * 4, 1.3, t, { eyes: 1.4 + (g > 0 ? 0.5 * Math.exp(-g * 3) : 0), heat: 0.9, crown: 1, rage: g > 0 ? 0.5 : 0.2, roar: g > 0 ? 0.6 * Math.exp(-g * 2) * (1 - Math.exp(-g * 20)) : 0, tilt: -0.08 * stag, nod: -2 * stag,
      wounds: g > 0 ? [W1] : [], arms: [{ x: -132, y: 60 - stag * 30, pose: 'open' }, { x: 132, y: 100, pose: 'fist' }, { x: -96, y: 196, pose: 'open' }, { x: 96, y: 196, pose: 'fist' }] });
    // the blade: in from off the left, cutting down through him
    const swA = lerp(-0.95, 0.55, eic(clamp((lt - h + 0.06) / 0.08, 0, 1))) + (g > 0 ? 0.25 * eoc(clamp(g / 0.3, 0, 1)) : 0);
    bigBlade(-40, 100, swA, 520, 5, t, { form: 'nova', flare: 0.8 });
    if (g > 0) { const sx = 300 + stag * 24 + lerp(WOUND1[0], WOUND1[2], 0.5) * 1.3, sy = 70 + lerp(WOUND1[1], WOUND1[3], 0.5) * 1.3; rocks(sx, sy, g, 34, 240, 3, [102, 104, 105, 107], 4461, 240, 0.4, 2); megaHit(sx, sy, g, 2.6, 0.4, [22, 107, 104], 4462); }
    shk(g > 0 ? 7 * Math.exp(-g * 3) : 1);
    const [kz, kr] = kick(lt, [[h, 1.8]]);
    z5Cam(1.06 + kz, kr, 280, 130, 240, 135);
  });

  /* 27 — the upward cut (0:51.4–0:52.8): from under his guard; a gauntlet thrown up and back, blades blown out of his crown */
  shot(51.4, 52.8, (lt, t) => {
    belowWorld(t, 140, 980, 0.8);
    const h = 0.2, g = lt - h, up = g > 0 ? eoc(clamp(g / 0.3, 0, 1)) : 0;
    const crown = 1 - 0.25 * up;
    sunderer(320, 84, 1.1, t, { eyes: 1.6, heat: 0.9, crown, rage: 0.5, roar: 0.3 * up, nod: -1.5 * up, tilt: 0.06 * up,
      wounds: [WOUND1], arms: [{ x: lerp(-40, -140, up), y: lerp(40, -90, up), pose: 'open', front: true }, { x: 132, y: 100, pose: 'fist' }, { x: -96, y: 196, pose: 'fist' }, { x: 96, y: 196, pose: 'fist' }] });
    // crown blades flying off
    if (g > 0) rocks(320, 40, g, 9, 260, 6, [96, 97, 101, 103], 4471, 200, -PI / 2, 1.6);
    const swA = lerp(1.0, -1.25, eic(clamp((lt - h + 0.05) / 0.07, 0, 1))) - (g > 0 ? 0.25 * eoc(clamp(g / 0.4, 0, 1)) : 0);
    const a = i4Nova(130, 200, 1.9, t, { sw: swA, spread: 0.9, flap: 0.4, mouth: 2, noSmear: true, ang: -0.2 });
    bigBlade(a.hand[0], a.hand[1], swA, 420, 4.6, t, { form: 'nova', flare: 0.8 });
    megaHit(270, 120, g, 2.4, -PI / 2 - 0.3, [22, 108, 105], 4472);
    shk(g > 0 ? 6 * Math.exp(-g * 3) : 1);
    const [kz, kr] = kick(lt, [[h, 1.5]]);
    z5Cam(1.04 + kz, kr, 240, 140, 240, 140);
  });

  /* 28 — the thrust (0:52.8–0:54): it lunges with everything, the giant blade straight out: through his shoulder, and on,
     driving him back into a spire, pinning him there */
  shot(52.8, 54.0, (lt, t) => {
    belowWorld(t, 140, 1000, 0.8);
    const h = 0.4, g = lt - h, coil = eio(clamp(lt / 0.3, 0, 1)) * (g < 0 ? 1 : 0), lunge = g > -0.06 ? eic(clamp((g + 0.06) / 0.06, 0, 1)) : 0;
    const pin = g > 0 ? eoc(clamp(g / 0.15, 0, 1)) : 0, SX = 340 + pin * 30;
    // the spire behind him; it cracks when he hits it
    for (let q = 0; q < 210; q++) { const w = 70 * (1 - q / 260); thick(420 - w / 2, 250 - q, 420 + w / 2, 250 - q, 2, q % 37 < 2 ? 102 : g > 0.15 && Math.abs((q * 7) % 53 - 26) < 1 ? 104 : q < 120 ? 98 : 99); }
    sunderer(SX, 78, 1.0, t, { eyes: 1.6, heat: 0.9, crown: 0.75, rage: 0.6, roar: g > 0 ? 0.7 * Math.exp(-g * 2) : 0, tilt: 0.1 * pin, wounds: g > 0 ? [WOUND1, WOUND2] : [WOUND1],
      arms: [{ x: -130, y: 80, pose: 'open' }, { x: 140, y: 60 + pin * 30, pose: 'open' }, { x: -96, y: 196, pose: 'fist' }, { x: 110, y: 190, pose: 'open' }] });
    const hx = lerp(110 - coil * 20, 200, lunge), hy = 170;
    const a = i4Nova(hx, hy, 2.0, t, { sw: -0.08, spread: 0.6 + 0.4 * lunge, flap: 0.4, mouth: 2, noSmear: true, sq: 0.3 * coil - 0.2 * lunge });
    bigBlade(a.hand[0], a.hand[1], -0.12, 460, 4.8, t, { form: 'nova', flare: 0.8 });
    if (g > 0) { megaHit(SX + 74, 120, g, 2.4, -0.1, [22, 108, 105], 4481); rocks(430, 120, g, 30, 180, 5, [97, 98, 99, 104], 4482, 200, 0, 2); }
    shk(g > 0 ? 8 * Math.exp(-g * 3) : coil * 1.5);
    const [kz, kr, kx] = kick(lt, [[h, 2, 0]]);
    z5Cam(1.05 + kz, kr, 270 - kx, 140, 240, 140);
  });
  FLASH_CUTS.push(53.2);

  /* 29 — he laughs (0:54–0:55.6): pinned, he laughs; a hand closes round the blade, and he draws it back out of himself,
     slowly, the hero dragged along the length of its own sword */
  shot(54.0, 55.6, (lt, t) => {
    belowWorld(t, 140, 1000, 0.8);
    const draw = eio(clamp((lt - 0.4) / 1.1, 0, 1)), laugh = [0.1, 0.35, 0.6].reduce((s_, h) => s_ + Math.max(0, Math.sin(PI * clamp((lt - h) / 0.2, 0, 1))), 0);
    const SX = 370;
    for (let q = 0; q < 210; q++) { const w = 70 * (1 - q / 260); thick(420 - w / 2, 250 - q, 420 + w / 2, 250 - q, 2, q % 37 < 2 ? 102 : q < 120 ? 98 : 99); }
    // the hero first (it is in front of nothing of his), then him: his hand closes round the blade — palm under it, fingers
    // over it — and the blade is drawn inside the grip, so it is held, not overlaid
    const hx = 200 - draw * 70, hy = 170 + z5Sh(t, 4) * 2;
    const a = i4Nova(hx, hy, 2.0, t, { sw: -0.08, spread: 0.7, flap: 0.6, mouth: 2, noSmear: true, sq: -0.15 + z5Sh(t * 2, 3) * 0.08 });
    const grip = eoc(clamp(lt / 0.3, 0, 1)), strainP = z5Sh(t * 1.5, 6) * 2 * draw;
    // the grip point on the blade (it slides out through his hand as he draws it), and the wrist placed so the knuckles sit
    // just over the blade with the fingers wrapping down round it
    const gx = 318 - draw * 46, gy = a.hand[1] + (gx - a.hand[0]) * Math.tan(-0.12), GA = PI / 2 - 0.35;
    const wlx = (gx - Math.cos(GA) * 12 - SX) / 1.0, wly = (gy - Math.sin(GA) * 12 - 78) / 1.0;
    const so = sunderer(SX, 78, 1.0, t, { eyes: 1.4, heat: 0.9, crown: 0.75, rage: 0.4, roar: 0.25 + laugh * 0.3, nod: -laugh * 2, wounds: [WOUND1, WOUND2], lean: -draw * 10,
      arms: [{ x: wlx, y: wly + strainP * 0.3, pose: { curl: lerp(0.15, 0.78, grip), thumb: lerp(0.2, 0.75, grip), spread: lerp(0.6, 0.05, grip) }, front: true, ang: GA,
        hold: () => { bigBlade(a.hand[0], a.hand[1], -0.12, 460 - draw * 70, 4.8, t, { form: 'nova', flare: 0.6 }); } }, { x: 140, y: 90 + laugh * 4, pose: 'fist' }, { x: -96, y: 196, pose: 'fist' }, { x: 110, y: 190, pose: 'open' }] });
    // where the porcelain grips the blade: it smokes and spits
    if (so.hands[0]) { const [gx, gy] = so.hands[0].palm; for (let k = 0; k < 8; k++) { const g = frac(t * 2 + k / 8); P(gx + (ih(k, 1, 4492) - 0.5) * 16, gy - g * 30, g < 0.4 ? 105 : 121); } }
    // the molten blood running out of the hole as the blade comes out
    for (let k = 0; k < 10; k++) { const g = frac(t * 1.4 + ih(k, 1, 4491)); rectF(SX + 74 + (ih(k, 2, 4491) - 0.5) * 10, 120 + g * 90, 2, 3, g < 0.5 ? 105 : 103); }
    shk(1 + laugh * 2);
    z5Cam(1.05, 0, 280, 140, 240, 140);
  });

  /* 30 — his brother's eye (0:55.6–0:58): close. The fist with the shard comes up to his brow and presses it in. It sinks
     into him; a spiral eye opens in his forehead. "Brother. See this." */
  shot(55.6, 58.0, (lt, t) => {
    gradient(LB, H - LB, [96, 97, 98, 101, 70]);
    const MX = 240, MY = 150, s = 3.2, press = eio(clamp(lt / 0.25, 0, 1)), sink = eic(clamp((lt - 0.2) / 0.3, 0, 1)), open = eob(clamp((lt - 0.4) / 0.4, 0, 1));
    const away = eio(clamp((lt - 0.55) / 0.5, 0, 1));
    const o = sunderer(MX, MY, s, t, { eyes: 1.4 + open * 0.4, heat: 1, crown: 0.75, rage: 0.4 + open * 0.3, third: open, body: false, nod: lerp(-1, 1, open) });
    // the fist, coming up to the brow and away again
    const fx = MX + 30 * s - press * 22 * s + away * 30 * s, fy = MY + 20 * s - press * 30 * s + away * 30 * s;
    if (sink < 1) { z5MaskShard(fx - 10 * s, fy - 12 * s, 1.6 * (1 - sink * 0.8), 0.4, 1, 0, t); glow(fx - 10 * s, fy - 12 * s, 60, T_MAG, 0.6); }
    sGauntlet(fx + 10 * s, fy + 14 * s, s * 0.9, -PI * 0.75, 'fist', 1, t);
    if (lt > 0.4) { const g = lt - 0.4; shockRing(o.brow[0], o.brow[1], 6 + g * 500, 4 + g * 300, 4, [75, 73, 104], 1 - g / 0.6); glow(o.brow[0], o.brow[1], 90 * Math.exp(-g * 2), T_MAG, 0.6); if (g < 0.03) tintAll(T_MAG, 0.45); }
    shk(lt > 0.4 && lt < 1 ? 5 * (1 - (lt - 0.4) / 0.6) : 0.8);
    z5Cam(1.02 + 0.04 * eio(lt / 2.4), 0, 240, 135);
  });
  FLASH_CUTS.push(55.6);
  CAPS.push([56.4, 57.95, 's', 'SUNDERER', 'BROTHER. SEE THIS.']);
  }

  /* ================================================================ act IV — the stranger power (58.0–104.0) · agent A
     The Sunderer turns his brother's eye on the hero and plays NOVA backwards; then he cuts the world in two, and breaks the
     hero in the chasm: the storm, the gold, the four orbs crushed one by one. On the floor of the world, the hero burns its
     own life (LAST LIGHT) and the sword grows out of the chasm through the clouds; it takes two of his arms and his face,
     and then he catches it, snaps it, and drives the hero down through the floor of the world into the dark. */
  {
    /* -------------------------------------------------------------- state and helpers (all a4…) */
    const A4W0 = [[-60, 58, 44, 112, 3.5], [70, 34, 92, 52, 4]];             // his two wounds at 58.0 (they rewind closed)
    const A4SAVE = new Uint8Array(NP);
    const A4L = PAL.map((p) => p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15);
    const WARMF = [104, 105, 106, 107, 108, 109, 110], CORONA = [103, 105, 106, 107], LASTF = [101, 103, 104, 107];
    const ORBD = [[45, 46, 47], [48, 49, 50], [51, 52, 53], [54, 55, 56]];
    if (!FONT['—']) FONT['—'] = ['.....', '.....', '.....', '#####', '.....', '.....', '.....'];
    // the camera: zoom z and roll r about world (fx, fy) at the frame centre, plus a kick (from kick())
    function a4Cam(z, r, fx, fy, k) { k = k || [0, 0, 0, 0]; z5Cam(Math.max(1, z + k[0]), r + k[1], fx - k[2], fy - k[3], 240, 135); }
    const a4Tw = (t, s) => Math.sin(t * 23 + s) * 0.5 + Math.sin(t * 37 + s * 1.7) * 0.3 + Math.sin(t * 59 + s * 2.9) * 0.2;   // a tremble

    /* the Sunderer: the engine's own (the bump-mapped body, the sculpted arms with their physics, the jointed hands). His
       physics keep per-draw state by call order within a frame, but only start counting afresh when he is drawn before any
       hero in that frame — so count afresh here, whatever was drawn first */
    function a4Sund(cx, cy, s, t, o) {
      if (SLIFE.t !== LIFE.t) { SLIFE.n = 0; SLIFE.t = LIFE.t; }
      return sunderer(cx, cy, s, t, o || {});
    }

    /* the hero's wings in the colours of a form: 'nova' (flame-light), 'zenith' (prism, the engine's), 'ghost' (a magenta trace) */
    function a4Wings(x, y, s, t, spread, flap, kind) {
      if (spread <= 0.02) return;
      if (kind === 'zenith') { z5Wings(x, y, s, t, spread, flap); return; }
      const amp = flap === undefined ? 0.24 : flap, sh = fl(t * 8), gh = kind === 'ghost', ash = kind === 'ash';
      if (!gh && !ash) glow(x, y - 8 * s, 70 * s * spread, T_NOVA, 0.35 * spread);
      for (const sd of [-1, 1]) {
        const beat = z5Beat(t) * amp, arm = -0.78 - beat + (1 - spread) * 1.3, ax = Math.cos(arm) * sd, ay = Math.sin(arm), Lw = 40 * s * (0.35 + 0.65 * spread);
        for (const [N, len, rank] of [[9, 1, 0], [8, 0.62, 1], [7, 0.36, 2]]) for (let j = N - 1; j >= 0; j--) {
          const u = (j + 0.6) / N, bx = x + ax * Lw * u, by = y + ay * Lw * u - Math.sin(u * PI) * 5 * s;
          const bu = z5Beat(t - 0.12 * u) * amp, fr = lerp(PI / 2 - 0.12, -0.15 - bu * 1.5, Math.pow(u, 1.25)) - (1 - spread) * 0.5, fa = sd > 0 ? fr : PI - fr;
          const L = s * (15 + 30 * u) * len * (0.45 + 0.55 * spread), w = s * (4.4 - rank * 0.8);
          let fill = rank === 0 ? WARMF[(j + sh) % 7] : rank === 1 ? 106 : 108, rim = rank === 0 ? 22 : 107;
          if (gh) { fill = rank === 0 ? 73 : 72; rim = 74; } else if (ash) { fill = rank === 0 ? 121 : 120; rim = 122; }
          z5Kite(bx - Math.cos(fa) * 1.2, by - Math.sin(fa) * 1.2, fa, L + 2.4, w + 1.1, rim);
          z5Kite(bx, by, fa, L, w, fill);
          if (rank === 0 && !ash) lineP(bx, by, bx + Math.cos(fa) * L * 0.8, by + Math.sin(fa) * L * 0.8, gh ? 75 : 22);
        }
      }
    }
    // a dim orb (its light going out as k → 0)
    function a4Orb(x, y, k, r, lum) {
      if (lum <= 0.02) { discF(x, y, r * 0.8, 93); return; }
      glow(x, y, r * 3.2 * lum, EL_T[k], 0.45 * lum);
      discF(x, y, r, lum > 0.4 ? ORBD[k][1] : ORBD[k][0]); discF(x - r * 0.25, y - r * 0.25, r * 0.6, lum > 0.6 ? ORBD[k][2] : ORBD[k][1]);
      if (lum > 0.5) P(x - r * 0.4, y - r * 0.4, 22);
    }
    // the dim halo of orbs round (cx, cy); which[k] 0 hides one; front: the half nearer the camera
    function a4Halo(cx, cy, R, t, r, lum, which, front) {
      for (let k = 0; k < 4; k++) {
        if (which && !which[k]) continue;
        const a = t * 1.3 + k * TAU / 4, z = Math.sin(a);
        if ((z > 0) !== front) continue;
        a4Orb(cx + Math.cos(a) * R, cy + z * R * 0.35 - 3, k, r * (0.95 + 0.12 * z), lum * (which && which[k] !== 1 ? which[k] : 1));
      }
    }
    // a ghost of the hero: the sprite of state o, stamped flat in one colour (no life, no mask)
    function a4Ghost(o, x, y, S, ang, col, alpha) { buildSprite(HERO3(o)); stamp(x, y, S, ang, false, { color: col, alpha, noMask: true }); }
    // the NOVA hero: corona, flame wings, the white-hot body; o: { sw, eyes, mouth, corona, spread, flap, blade (len), ang, form, after, cracks, legs, sq }
    function a4Nova(x, y, S, t, o) {
      const cor = o.corona === undefined ? 1 : o.corona, sp = o.spread === undefined ? 1 : o.spread;
      if (cor > 0.02) glow(x, y, 46 * S * cor, T_NOVA, 0.55 * cor);
      a4Wings(x - Math.sin(o.ang || 0) * 6 * S, y - Math.cos(o.ang || 0) * 6 * S + z5Bob(t, S, o.flap) * sp, S * 0.6, t, sp, o.flap, o.wings || 'nova');
      const a = actor(HERO3({ form: o.form || 'nova', eyes: o.eyes || 'glow', mouth: o.mouth, sword: o.sw, swordCols: o.swordCols, sq: o.sq, legs: o.legs, cracks: o.cracks }), x, y, S, o.ang || 0, false, { after: o.after, bob: o.bob });
      if (cor > 0.02) aura(t, CORONA, 4 * S * cor, { sparks: fl(16 * cor), rise: o.rise === undefined ? 1 : o.rise });
      if (o.form === 'zenith') z5Eyes();
      if (o.blade > 0) { const ba = Math.atan2(a.tip[1] - a.hand[1], a.tip[0] - a.hand[0]); a.btip = bigBlade(a.hand[0], a.hand[1], ba, o.blade, o.bw || 5, t, { form: 'nova', flare: 0.7 * cor + 0.2, surge: o.surge }); a.ba = ba; }
      return a;
    }
    // REWIND, his way: the frame torn like a tape dragged backwards: rolling bands that climb, rows torn sideways, the
    // picture slipping, magenta and cyan fringes, a wobble, scanlines, and the ◀◀ in the corner
    function a4Rewind(amt, t) {
      if (amt <= 0) return;
      TMP.set(BUF);
      const f = fl(t * 30), roll = (t * 1500) % 140, slip = ih(f >> 1, 1, 4401) < 0.22 * amt ? fl((ih(f, 2, 4401) - 0.5) * 34 * amt) : 0;
      for (let y = LB; y < H - LB; y++) {
        const bd = ((y + roll) % 140 + 140) % 140, band = bd < 8 * amt, tear = ih(y >> 2, f, 4402) < 0.07 * amt ? Math.round((ih(y >> 2, f, 4403) - 0.5) * 60 * amt) : 0;
        const wav = Math.round(Math.sin(y * 0.08 + t * 21) * 3 * amt), sy = clamp(y + slip, LB, H - LB - 1), row = sy * W, o = y * W;
        for (let x = 0; x < W; x++) {
          const sx = clamp(x - tear - wav, 0, W - 1); let c = TMP[row + sx];
          if (amt > 0.5) { const l = A4L[c], lr = A4L[TMP[row + Math.min(W - 1, sx + 2)]], ll = A4L[TMP[row + Math.max(0, sx - 2)]]; if (lr - l > 110) c = 73; else if (ll - l > 110) c = 61; }
          if (band && bay(x, y) < 0.7 * amt) c = ih(x >> 1, y + f, 4404) < 0.45 ? 22 : ih(x, y, f) < 0.5 ? 20 : 74;
          BUF[o + x] = c;
        }
        if ((y & 1) && amt > 0.1) for (let x = 0; x < W; x++) if (bay(x, y) < amt * 0.2) BUF[o + x] = T_DARK[2][BUF[o + x]];
      }
      tintAll(T_MAG, 0.12 * amt);
      if (amt > 0.3 && (f >> 3) % 2 === 0) {
        for (const ox of [0, 13]) { z5Tri(44 + ox, 38, 44 + ox, 58, 32 + ox, 48, 0); z5Tri(43 + ox, 40, 43 + ox, 56, 34 + ox, 48, 22); }
        text('REWIND', 66, 44, 22, 2, 0);
      }
    }
    // the dial of his brother's eye: a clock face of void round the hero, its hands running backwards
    function a4Dial(cx, cy, r, t, amt, ry) {
      if (amt <= 0) return;
      ry = ry || 1;
      const keep = (x, y) => bay(fl(x), fl(y)) < amt;
      ring(cx, cy, r, r * ry, 74, keep); ring(cx, cy, r + 2, (r + 2) * ry, 72, keep); ring(cx, cy, r * 0.62, r * 0.62 * ry, 73, keep);
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU - t * 0.6, c = Math.cos(a), s = Math.sin(a), l0 = k % 3 ? 0.88 : 0.78; lineF(cx + c * r * l0, cy + s * r * l0 * ry, cx + c * r, cy + s * r * ry, (x, y) => { if (keep(x, y)) P(x, y, k % 3 ? 74 : 75); }); }
      for (const [len, sp, w] of [[0.85, -9, 2], [0.55, -1.6, 3]]) { const a = t * sp, c = Math.cos(a), s = Math.sin(a); lineF(cx, cy, cx + c * r * len, cy + s * r * len * ry, (x, y, u) => { if (bay(x, y) < amt * (1 - u * 0.4)) { P(x, y, 75); if (w > 2) P(x + 1, y, 73); } }); }
    }
    // the cloud cover seen from below: a ceiling with its belly lit by the fire; holes punched in it show the dawn above
    function a4Ceil(yb, h, ox, holes, lit) {
      lit = lit === undefined ? 1 : lit;
      for (let x = 0; x < W; x++) {
        const wx = x + ox, f = fbm(wx, 0, 70, 4, 4411), bot = yb + h * f, y1 = Math.min(H - LB, Math.ceil(bot));
        for (let y = LB; y < y1; y++) {
          const dd = bot - y;
          let hole = false;
          if (holes) for (const [hx, hy, hr] of holes) { const dx = (x - hx) / hr, dy = (y - hy) / (hr * 0.3); const d = dx * dx + dy * dy; if (d < 1) { hole = true; BUF[y * W + x] = d > 0.8 ? 106 : d > 0.55 ? 15 : 16; break; } }
          if (hole) continue;
          const n = vn(wx, y, 9, 4412), m = vn(wx * 1.7, y * 2, 5, 4413), b = bay(x, y);
          let c = dd < 1.5 ? (lit > 0.5 ? 103 : 99) : dd < 4 ? (lit > 0.5 ? (b < 0.5 ? 102 : 103) : 98) : dd < 7 + 5 * m ? (lit > 0.5 && b < 0.5 ? 102 : 121) : dd < 12 + 9 * n ? (m > 0.5 ? 121 : b < 0.5 ? 120 : 121) : n > 0.6 ? 120 : 97;
          if (b < 0.14 && dd > 4) c = 120;
          BUF[y * W + x] = c;
        }
      }
    }
    // a stump of rock out of the sea: flat broken top at (x0..x1, top), jagged sides down to the water
    function a4Rock(x0, x1, top, bot, seed, lit) {
      for (let y = Math.max(LB, fl(top)); y < Math.min(H - LB, bot); y++) {
        const v = (y - top) / (bot - top), l = x0 - v * 14 - vn(y * 0.3, 1, 1, seed) * 8, r = x1 + v * 12 + vn(y * 0.3, 2, 1, seed) * 8, R = a4TexRow(seed, fl(y * 1.4));
        for (let x = Math.max(0, fl(l)); x <= Math.min(W - 1, r); x++) {
          const e = (x - l) / Math.max(1, r - l);
          BUF[y * W + x] = y - top < 1.5 ? (lit ? 123 : 122) : y - top < 3.5 ? (lit ? 122 : 121) : a4Lit(R[x], x, y, 0.15, lit ? 0.45 : 0.2, e < 0.15 ? 1 : e > 0.8 ? -2 : -1 + (v < 0.2 ? 1 : 0));
        }
      }
    }
    // a column of falling water (the sea pouring into the chasm), from y0 down to y1 at x
    function a4Falls(x, y0, y1, w, t, seed) {
      for (let y = Math.max(LB, fl(y0)); y < Math.min(H - LB, y1); y++) {
        const d = y - y0, sp = d * 0.06, wid = w + sp * 2, thin = Math.min(0.8, d / 260);
        for (let q = -sp; q < w + sp; q += 1) {
          const n = ih(fl(x + q), fl(y - t * 240) >> 2, seed), edge = Math.min(q + sp, w + sp - q) / (wid * 0.5);
          if (n < 0.3 + thin * 0.5 + (1 - Math.min(1, edge * 2)) * 0.4) continue;
          P(x + q, y, n > 0.9 ? 22 : n > 0.7 ? 119 : 118);
        }
      }
      for (let k = 0; k < w; k++) { const g = frac(ih(k, 1, seed) + t * 1.4), px = x + ih(k, 2, seed) * w + (ih(k, 3, seed) - 0.5) * 20 * g, py = y0 + 2 - Math.sin(g * PI) * 8; if (bay(fl(px), fl(py)) < 1 - g) P(px, py, 22); }
    }

    /* ============================================================== 1 · REWIND (58.0–60.0)
       His third eye opens on the hero, and NOVA plays backwards: the blade retracts, the flame wings fold, the corona is drawn
       back into the body, it flickers back through Zenith, the four orbs come out of its chest, and it is plain coral again,
       standing on a stump of rock. His wounds close the same way. Everything is torn like a tape dragged backwards. */
    const A4RW = (t) => { const p = eio(lin(58.14, 59.72, t)), st = frac(t * 6.3); return clamp(p - (st < 0.2 ? 0.07 * Math.sin(st / 0.2 * PI) : 0), 0, 1); };
    const a4Seg = (u, a, b) => sstep(a, b, u);
    function a4NovaState(u) {
      return {
        blade: u > 0.62 ? lerp(66, 430, eic((u - 0.62) / 0.38)) : 0,
        spread: a4Seg(u, 0.3, 0.74), corona: a4Seg(u, 0.24, 0.68),
        form: u > 0.5 ? 'nova' : u > 0.31 ? 'zenith' : undefined,
        x: lerp(116, 134, a4Seg(u, 0.1, 0.9)), y: lerp(183, 163, a4Seg(u, 0.12, 0.6)),
        sw: lerp(0.55, -0.42, a4Seg(u, 0.05, 0.85)), orbs: 1 - a4Seg(u, 0.02, 0.3),
      };
    }
    shot(58.0, 60.0, (lt, t) => {
      const p = A4RW(t), u = 1 - p, stt = frac(t * 6.3) < 0.2, rw = t > 58.07 && t < 59.78 ? Math.min(1, (t - 58.07) / 0.12) * (stt ? 1 : 0.6) : 0;
      // the world plays backwards too (the swell, the fires on the spires), scrubbing faster as it goes
      const tw = t < 58.07 ? t : 58.07 - (t - 58.07) * (1.5 + p * 3);
      belowWorld(tw, 150, tw * 10, 0.85);
      a4Ceil(LB - 6, 22, 40 + tw * 3, null, 1);
      a4Rock(70, 168, 214, 250, 4421, true);
      // the Sunderer turns his brother's eye on it; one upper hand open towards it, turning slowly backwards like a dial
      const turn = eio(lin(58.0, 59.8, t)), wc = 1 - eio(lin(58.55, 59.55, t + (frac(t * 6.3) < 0.2 ? -0.06 : 0)));
      const wounds = A4W0.map(([a, b, c, d, w], k) => { const m = k ? Math.min(1, wc * 1.4) : wc, mx = (a + c) / 2, my = (b + d) / 2; return [lerp(mx, a, m), lerp(my, b, m), lerp(mx, c, m), lerp(my, d, m), w * (0.4 + 0.6 * m)]; }).filter((w) => Math.hypot(w[2] - w[0], w[3] - w[1]) > 1.5);
      const so = a4Sund(322, 92, 1.2, t, { third: 1, eyes: 1.3, heat: 0.8, crown: 0.75, rage: 0.3, wounds, tilt: -0.05 * turn,
        arms: [{ x: -142, y: 38 - turn * 10, pose: 'open', ang: -PI / 2 - 0.5 - turn * 1.3 }, a4Rest(128, 150, 11, t), a4Rest(-84, 186, 12, t), a4Rest(92, 182, 13, t)] });
      // the wounds close with light running along them, backwards
      if (wc > 0 && wc < 1) for (const [a, b, c, d] of wounds) for (const e of [[a, b], [c, d]]) sparkle(322 + e[0] * 1.2, 92 + e[1] * 1.2 + Math.sin(t * 0.9) * 1.2, 2 + 3 * ih(fl(t * 30), e[0] | 0, 4431), 22, 105);
      // his eye: at the hit a ring of void runs out from it; then a thread of magenta binds it to the hero
      const [bx, by] = so.brow, g0 = t - 58.0;
      if (g0 < 0.5) { shockRing(bx, by, 6 + g0 * 700, 6 + g0 * 560, 4, [75, 73, 71], 1 - g0 / 0.5); glow(bx, by, 60 * (1 - g0 * 2), T_MAG, 0.9); }
      // the hero: ghosts of what it just was trail it (ahead in time, behind on screen), then it, unwinding
      const s0 = a4NovaState(u);
      for (let k = 3; k >= 1; k--) {
        if (rw <= 0) break;
        const sk = a4NovaState(Math.min(1, u + k * 0.1)), ga = 0.5 - k * 0.12;
        a4Ghost({ form: sk.form, sword: sk.sw, eyes: 'glow' }, sk.x, sk.y, 2.2, 0, k === 1 ? 75 : 73, ga);
        if (sk.blade > 0) { const a = sk.sw - 0.12; lineF(sk.x + 30, sk.y + 2, sk.x + 30 + Math.cos(a) * sk.blade, sk.y + 2 + Math.sin(a) * sk.blade, (x, y) => { if (bay(x, y) < ga) P(x, y, 73); }); }
      }
      if (rw > 0) a4Dial(s0.x, s0.y, 58 + 10 * Math.sin(t * 3), t * 3, 0.55 * rw, 0.8);
      // particles drawn back into it: the corona's sparks running in, not out
      if (rw > 0) for (let k = 0; k < 40; k++) { const q = frac(ih(k, 1, 4432) - t * 1.6), a = ih(k, 2, 4432) * TAU, r = 14 + q * 90, x = s0.x + Math.cos(a) * r, y = s0.y + Math.sin(a) * r * 0.8; if (s0.corona < 0.05 && k % 3) continue; lineP(x, y, x + Math.cos(a) * 4, y + Math.sin(a) * 4 * 0.8, q < 0.3 ? 22 : k % 2 ? 106 : 74); }
      const jud = rw ? a4Tw(t, 1) * 2 : 0;
      // which form: near a boundary the rows interlace the two (a tape caught between frames)
      const drawHero = (st) => a4Nova(st.x + jud, st.y, 2.2, t, { sw: st.sw + jud * 0.04, eyes: t < 58.15 ? 'glow' : 'wide', mouth: t < 58.15 ? 0 : rw ? 2 : 1, corona: st.corona, spread: st.spread, blade: st.blade, form: st.form, wings: st.form === 'zenith' ? 'zenith' : 'nova', rise: -1.2, bob: 0, legs: st.spread > 0.3 ? undefined : [0, 0, 0, 0] });
      const near = [0.5, 0.31].find((b) => Math.abs(u - b) < 0.05);
      if (near !== undefined && rw) {
        // the form before, and over it the form after, kept only on alternate pairs of rows
        drawHero(a4NovaState(near + 0.06)); A4SAVE.set(BUF);
        const sv = a4NovaState(near - 0.06), ph = fl(t * 30);
        a4Wings(sv.x + jud, sv.y - 13, 1.3, t, sv.spread, 0.24, sv.form === 'zenith' ? 'zenith' : 'nova');
        actor(HERO3({ form: sv.form, eyes: 'wide', mouth: 2, sword: sv.sw }), sv.x + jud, sv.y, 2.2, 0, false, { still: true });
        for (let y = LB; y < H - LB; y++) if ((((y >> 1) + ph) & 1) === 0) BUF.set(A4SAVE.subarray(y * W, y * W + W), y * W);
      } else drawHero(s0);
      // the orbs come back out of its chest (the way they went in), and settle round it, dim
      if (s0.orbs > 0) for (let k = 0; k < 4; k++) {
        const e = eoc(clamp(s0.orbs * 1.3 - k * 0.1, 0, 1)), a = t * 1.3 + k * TAU / 4, tx = s0.x + Math.cos(a) * 30, ty = s0.y + Math.sin(a) * 10 - 3;
        a4Orb(lerp(s0.x, tx, e), lerp(s0.y, ty, e), k, 2.6, 1 - 0.55 * e);
      }
      a4Rewind(rw, t);
      if (t < 58.02) impactFrame(bx, by, 1);
      const pz = eio(lin(58.1, 59.85, t));
      a4Cam(1 + 0.22 * pz, (rw ? 0.02 * a4Tw(t * 0.3, 2) : 0), lerp(240, 190, pz), lerp(135, 158, pz), kick(t, [[58.0, 2.5, -PI / 2]]));
      shk(rw ? 1.5 : 0); if (g0 < 0.3) shk(6 * (1 - g0 / 0.3));
    });
  
    /* -------------------------------------------------------------- the chasm
       Its rock is one lit texture in world space (x across, wy down), cached row by row as it is first seen: tilted strata of
       two rocks (black glass and ash-grey stone) with dark partings between them, relief from three octaves of noise lit from
       above, and molten seams. Each texel keeps its brightness (0..7), which way it faces (up, level, down), its stratum and
       how near a seam it is, so walls scroll for nothing and are lit afresh each frame by a4Lit. */
    const A4TX = new Map();
    function a4TexRow(seed, wy) {
      let T = A4TX.get(seed); if (!T) A4TX.set(seed, T = new Map());
      let r = T.get(wy); if (r) return r;
      r = new Uint8Array(W); T.set(wy, r);
      const sl = (ih(seed, 1, 4590) - 0.5) * 0.022, sx = (seed % 17) * 3.1;
      const hf = (x, y) => vn(x, y, 13, seed + 1) * 1.1 + vn(x, y, 4.5, seed + 2) * 0.45 + vn(x, y, 1.7, seed + 3) * 0.14;
      const sv = (x, y) => y * 0.045 + x * sl + vn(x, y, 90, seed + 4) * 1.3 + vn(x, y, 23, seed + 6) * 0.25;
      const rdg = (q) => { const g = q - fl(q); return g < 0.07 ? -0.6 : Math.sin(g * PI) * 0.35; };
      for (let x = 0; x < W; x++) {
        const s0 = sv(x, wy), band = fl(s0), f = s0 - band;
        const h0 = hf(x, wy) + rdg(s0), gx = hf(x + 1, wy) + rdg(sv(x + 1, wy)) - h0, gy = hf(x, wy + 1) + rdg(sv(x, wy + 1)) - h0;
        const lit = 0.5 - gy * 2.4 - gx * 0.9 + (f < 0.07 ? -0.3 : 0) + (ih(band, 3, seed) - 0.5) * 0.25;
        const lvl = clamp(fl(lit * 7 + (ih(x, wy, seed + 5) - 0.5) * 0.8), 0, 7), face = gy < -0.05 ? 1 : gy > 0.07 ? 2 : 0;
        const sd = vn(x, wy, 60, seed + 7) < 0.52 ? 1 : seamAt(x / 64 + sx, wy / 52), sq = sd < 0.009 ? 0 : sd < 0.024 ? 1 : sd < 0.045 ? 2 : 3;
        r[x] = lvl | (face << 3) | ((band & 1) << 5) | (sq << 6);
      }
      return r;
    }
    // a texel lit for this frame: hot 0..1 the fire's light on it (lit faces turn red, seams burn), sky 0..1 the cold dawn
    // far above (lit faces turn ash-pale), k extra brightness
    const A4RA = [96, 96, 97, 98, 98, 99, 100, 100], A4RB = [96, 97, 97, 120, 121, 121, 122, 122];
    function a4Lit(v, x, y, hot, sky, k) {
      let lvl = (v & 7) + k; lvl = lvl < 0 ? 0 : lvl > 7 ? 7 : lvl;
      const face = (v >> 3) & 3, B = (v >> 5) & 1, sq = v >> 6, b = bay(x, y);
      let c = B ? A4RB[lvl] : A4RA[lvl];
      if (face === 1 && lvl >= 4) { if (b < hot * 1.2) c = lvl >= 6 && hot > 0.45 ? 103 : lvl >= 5 ? 102 : 101; else if (b < sky && lvl >= 5) c = B ? 123 : 122; }
      else if (face === 2 && lvl < 4 && b < 0.5) c = 96;
      if (sq === 0) { if (hot > 0.03) c = hot > 0.6 ? (b < 0.5 ? 106 : 105) : hot > 0.35 ? 104 : hot > 0.15 ? 103 : 102; }
      else if (sq === 1) { if (hot > 0.12) c = hot > 0.5 ? 103 : 102; }
      else if (sq === 2 && hot > 0.3 && b < hot - 0.2) c = 101;
      return c;
    }
    // a wall of the chasm: rock from the frame edge to a jagged face at xe (side -1: the wall is on the left), oy the camera's
    // depth (world y = y + oy); its seams burn hotter near the top (heat at depth 0, cooling over cool px); the face's lip
    // catches the chasm's light, the rock deep in shadow away from it
    function a4Wall(side, xe, oy, t, heat, cool, seed, lit) {
      seed = seed || 4501; cool = cool || 900;
      for (let y = LB; y < H - LB; y++) {
        const wy = fl(y + oy), e = xe + (vn(wy * 0.05, 0, 1, seed) - 0.5) * 36 + (vn(wy * 0.21, 0, 1, seed + 1) - 0.5) * 9, hy = heat * clamp(1 - wy / cool, 0, 1);
        const xa = side < 0 ? 0 : Math.max(0, fl(e)), xb = side < 0 ? Math.min(W - 1, fl(e)) : W - 1, row = y * W, R = a4TexRow(seed, wy);
        for (let x = xa; x <= xb; x++) {
          const d = side < 0 ? e - x : x - e, near = d < 70 ? 1 - d / 70 : 0;
          let c = a4Lit(R[side < 0 ? x : W - 1 - x], x, y, hy * (0.35 + 0.65 * near), lit ? 0.35 : 0.1, d < 6 ? 2 : d < 18 ? 1 : d > 150 ? -1 : 0);
          if (d < 1.5) c = lit ? (hy > 0.25 ? 104 : 123) : hy > 0.2 ? 102 : 99;
          else if (d < 3) c = lit ? (hy > 0.25 ? 102 : 122) : 98;
          BUF[row + x] = c;
        }
      }
    }
    // the inside of the chasm behind the walls: its far face, dim and low in contrast, hazed with the fire's light (hotter
    // near the top), shafts of light falling from the cut far above
    function a4Deep(oy, t, heat, cool) {
      cool = cool || 900;
      for (let y = LB; y < H - LB; y++) {
        const wy = fl((y + oy) * 0.6), hy = heat * clamp(1 - (y + oy) / cool, 0, 1), row = y * W, R = a4TexRow(4512, wy);
        for (let x = 0; x < W; x++) {
          const v = R[x], lvl = v & 7, sq = v >> 6, b = bay(x, y);
          let c = lvl < 3 ? 96 : lvl < 6 ? 97 : (v >> 5) & 1 ? 120 : 98;
          if (b < hy * (0.08 + lvl * 0.045)) c = lvl > 4 ? 102 : 101;
          if (sq === 0 && hy > 0.3) c = hy > 0.65 ? 103 : 102;
          BUF[row + x] = c;
        }
      }
      // the shafts: soft slanting bands of the cut's light, drifting
      for (let k = 0; k < 4; k++) {
        const x0 = ih(k, 1, 4514) * 560 - 40 + Math.sin(t * 0.3 + k) * 12, w = 10 + ih(k, 2, 4514) * 26, sl = 0.25 + ih(k, 3, 4514) * 0.2, a = (0.05 + 0.07 * ih(k, 4, 4514)) * (0.4 + heat * 0.6);
        for (let y = LB; y < H - LB; y++) { const cx = x0 + (y - LB) * sl, fade = a * (1 - (y - LB) / (H - 2 * LB) * 0.6); for (let x = Math.max(0, fl(cx - w)); x < Math.min(W, cx + w); x++) { const e = 1 - Math.abs(x - cx) / w; tintI(y * W + x, x, y, T_WARM, fade * e); } }
      }
    }
    // embers and grit drifting in the chasm at three depths (speed px/s: + rising, - falling): far ones dim specks, near ones
    // bright, streaked along their motion and wavering more
    function a4Embers(t, n, speed, seed, cols) {
      cols = cols || [105, 103];
      const dn = speed > 0 ? 1 : -1;
      for (let k = 0; k < n; k++) {
        const z = ih(k, 7, seed), sp = speed * (0.4 + z * 1.2), y = LB + frac(ih(k, 1, seed) - t * sp / 218) * 218, x = ih(k, 2, seed) * W + Math.sin(t * (0.8 + z) + k) * (3 + 9 * z);
        if (z > 0.78) { P(x, y, cols[0]); P(x + 1, y, cols[1]); P(x, y + dn, cols[1]); P(x + 1, y + dn, 101); if (Math.abs(speed) > 60) { P(x, y + 2 * dn, cols[1]); P(x, y + 3 * dn, 101); } }
        else if (z > 0.35) { P(x, y, cols[k & 1]); P(x, y + dn, 101); }
        else if (bay(fl(x), fl(y)) < 0.75) P(x, y, 102);
      }
    }
    // the hero's sword as a loose piece (dropped, flung): hilt at (x, y), pointing a, scale S; broken leaves a stub
    function a4Sword(x, y, a, S, cols, cracked, broken) {
      const ux = Math.cos(a), uy = Math.sin(a), L = (broken ? 6 : 27) * S, w = Math.max(1, 1.8 * S);
      capsF(x - ux * 5 * S, y - uy * 5 * S, x, y, Math.max(1, S), Math.max(1, S), () => 38);
      capsF(x - uy * 4 * S, y + ux * 4 * S, x + uy * 4 * S, y - ux * 4 * S, Math.max(1, S * 0.9), Math.max(1, S * 0.9), (u, d) => (d > 0.6 ? 51 : 58));
      for (let q = 2 * S; q < L; q += 0.5) {
        const f = q / L, hw = broken ? w * (1 - Math.max(0, ih(fl(q), 1, 4521) - 0.4)) : f > 0.86 ? w * (1 - f) / 0.14 : w;
        for (let v = -hw; v <= hw; v += 0.5) { const px = x + ux * q - uy * v, py = y + uy * q + ux * v; P(px, py, v < -hw * 0.4 ? 22 : cols ? cols[fl(frac(q * 0.08 / S) * cols.length)] : q < 4 * S ? 33 : 34); }
      }
      if (cracked) for (let k = 0; k < 3; k++) { const q = (8 + k * 6) * S, px = x + ux * q, py = y + uy * q; lineP(px - uy * w, py + ux * w, px + ux * 2 * S + uy * w, py + uy * 2 * S - ux * w, 96); }
      return [x + ux * L, y + uy * L];
    }

    /* ============================================================== 2 · the horror (60.0–62.0)
       Close: it stares at its ordinary sword, the last spark of NOVA dying off the blade. Then from low on the rock: he lifts
       one hand above his head, flat, like a blade. */
    shot(60.0, 61.15, (lt, t) => {
      gradient(LB, 180, [96, 97, 98, 9, 10, 98]);
      for (let k = 0; k < 7; k++) { const x = 30 + k * 70 + Math.sin(k * 3.1) * 20, y = 120 + Math.sin(k * 1.7) * 20; glow(x, y, 26 + (k % 3) * 8, T_EMBER, 0.5); discF(x, y, 3 + (k % 2) * 2, k % 2 ? 103 : 102); }
      for (let y = 180; y < H - LB; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = bay(x, y) < (y - 180) / 70 ? 114 : 115;
      // his mass at the frame's right edge, out of focus: dark, a seam of fire, the third eye far up
      for (let y = LB; y < H - LB; y++) { const e = 400 + Math.sin(y * 0.02) * 10 + (y - LB) * 0.15, R = a4TexRow(4534, fl(y * 0.5 + 300)); for (let x = fl(e); x < W; x++) { const d = x - e; BUF[y * W + x] = d < 1.5 ? 102 : d < 4 ? 98 : a4Lit(R[fl(x * 0.5)], x, y, 0.3 * Math.max(0, 1 - d / 40), 0.1, -2); } }
      lineF(430, LB, 452, H - LB, (x, y) => { if (bay(x, y) < 0.6) P(x, y, 102); });
      glow(452, 40, 30, T_MAG, 0.5);
      a4Embers(t, 30, -14, 4531, [103, 102]);
      const tr = a4Tw(t, 3) * (0.6 + lt * 0.5), S = 5;
      const hx = 196 + tr * 0.8, hy = 160 + Math.sin(lt * 2.2) * 1.5;
      a4Halo(hx, hy, 100, t * 0.6, 7, 0.75, null, false);
      const a = actor(HERO3({ eyes: lt > 0.95 && lt < 1.02 ? 'closed' : 'wide', mouth: lt > 0.6 ? 2 : lt > 0.25 ? 1 : 0, sword: -1.05 + tr * 0.025, legs: [0, 0, 0, 0] }), hx, hy, S, -0.04, false, { bob: 0 });
      a4Halo(hx, hy, 100, t * 0.6, 7, 0.75, null, true);
      // it tries to make the blade grow again: twice the light runs up it and gutters out, the second time weaker
      const ba = Math.atan2(a.tip[1] - a.hand[1], a.tip[0] - a.hand[0]);
      for (const [t0, pw] of [[0.22, 1], [0.62, 0.5]]) {
        const g = lt - t0; if (g < 0 || g > 0.32) continue;
        const up = eoc(Math.min(1, g / 0.1)), dn = 1 - eic(lin(0.1, 0.32, g)), L = 29 * S * (1 + 1.3 * pw * up * dn);
        bigBlade(a.hand[0], a.hand[1], ba, L, 4.5, t, { form: 'nova', grow: 0.999, flare: 0.8 * pw * dn });
        glow(a.tip[0], a.tip[1], 40 * pw * dn, T_NOVA, 0.6 * dn);
        if (g > 0.1) for (let k = 0; k < 8 * pw; k++) { const q = (g - 0.1) / 0.22, x = a.tip[0] + (ih(k, 1, 4533) - 0.5) * 30 * q, y = a.tip[1] - 10 + q * 60 * ih(k, 2, 4533) + q * q * 40; if (bay(fl(x), fl(y)) < 1 - q) P(x, y, q < 0.5 ? 106 : 103); }
      }
      // the last ember of it drifts off the point and goes out
      const g = lt - 0.7; if (g > 0 && g < 0.45) { const q = g / 0.45, x = a.tip[0] + q * 14, y = a.tip[1] - q * 26 - Math.sin(q * 9) * 3; sparkle(x, y, 2.5 * (1 - q) + 0.6, q < 0.5 ? 22 : 106, 105); }
      a4Cam(1 + 0.05 * lt, 0, 220, 140);
    });
    // low on the rock, looking up past the hero: his hand rises above his head into the cloud light, flat as a blade
    shot(61.15, 62.0, (lt, t) => {
      const rise = eio(lin(61.18, 61.78, t)), chop = eic(lin(61.88, 62.0, t)), camY = 60 * eio(lin(61.15, 61.8, t));
      belowWorld(t, 168 + camY, t * 10, 0.85);
      a4Ceil(LB + camY * 0.5 - 4, 26, 70, null, 1);
      const hx = lerp(lerp(150, 30, rise), -170, chop), hy = lerp(lerp(150, -96, rise), 240, chop);
      const so = a4Sund(318, 110 + camY, 0.95, t, { third: 1, eyes: 1.2, heat: 0.8, crown: 0.75, tilt: 0.04 * rise - 0.1 * chop, nod: -2 * rise,
        arms: [a4Rest(-150, 150, 14, t), { x: hx, y: hy, pose: a4PL('fist', 'chop', eoc(lin(61.15, 61.5, t))), ang: lerp(-PI / 2 - 0.1, PI * 0.7, chop), heat: 0.6 + rise * 0.4 }, a4Rest(-86, 196, 15, t), a4Rest(92, 192, 16, t)] });
      const [qx, qy] = so.hands[1];
      if (rise > 0.9 && chop < 0.1) { glow(qx, qy, 40, T_EMBER, 0.6); sparkle(qx + 4, qy - 22, 2 + 4 * frac(t * 3), 22, 106); }
      if (chop > 0.05) { streaks(Math.atan2(240 - hy, -170 - hx), 26, t, 2600, 105, 90, 4541, [0, LB, W, H - 2 * LB]); smearArc(318 + 84 * 0.95, 110 + camY + 40 * 0.95, -PI / 2, -PI / 2 + chop * 2.2, 190, [102, 104, 22]); }
      // the hero on its rock in the near corner, small, its back half to us, watching it rise
      a4Rock(-20, 150, 222 + camY * 0.7, 300, 4422, true);
      actor(HERO3({ eyes: 'wide', sword: 0.5, legs: [0, 0, 0, 0] }), 92, 206 + camY * 0.7 - 14, 1.6, 0.02, false, {});
      a4Halo(92, 192 + camY * 0.7, 24, t * 0.6, 1.6, 0.3, null, true);
      shk(chop > 0 ? 3 : rise > 0.95 ? 0.6 : 0);
      a4Cam(1.02 + 0.03 * rise, -0.02 * rise, 240, 135);
    });

    /* ============================================================== 3 · SUNDER (62.0–63.0)
       Wide: the hand comes down and the world is cut in two along a line that runs from under the camera to the horizon and
       on up the sky: the sea, the horizon, the clouds. The halves slide apart over a burning chasm; the sea pours in off both
       lips and boils. Then close: the lip under the hero breaks and it falls in. */
    // the split in perspective: the cut runs from (bx, bottom) to the vanishing point (vx, hz) and straight up the sky; gap is
    // its width at the bottom row (it narrows to the horizon), sky its width in the sky; run 0..1 how far it has raced
    function a4Sunder(vx, hz, bx, gap, sky, run, t) {
      TMP.set(BUF);
      const bot = H - LB, f = fl(t * 30);
      for (let y = LB; y < bot; y++) {
        const below = y >= hz, q = below ? (y - hz) / (bot - hz) : 0, cx = below ? lerp(vx, bx, q) : vx + (hz - y) * 0.02;
        const reach = below ? q > 1 - run * 1.25 : (hz - y) / (hz - LB) < run * 1.4 - 0.25;
        if (!reach) continue;
        const half = below ? gap * (0.04 + 0.96 * q) / 2 : sky / 2, row = y * W;
        for (let x = 0; x < W; x++) {
          const d = x + 0.5 - cx;
          if (d < -half) { BUF[row + x] = TMP[row + clamp(fl(x + half), 0, W - 1)]; continue; }
          if (d > half) { BUF[row + x] = TMP[row + clamp(fl(x - half), 0, W - 1)]; continue; }
          const e = half > 0.5 ? Math.abs(d) / half : 0;
          let c;
          if (below) {
            // the cut faces of the sea floor fall away into the glow; foam and steam along the lips
            const fall = (1 - e) * 1.0, wy = y * 1.0 - t * 160;
            c = e > 0.9 ? (ih(x, fl(wy) >> 1, 4571) < 0.6 ? 119 : 22) : e > 0.55 ? (vn(x * 0.3, wy * 0.3, 3, 4572) > 0.5 ? 99 : 98) : e > 0.3 ? (bay(x, y) < 0.5 ? 101 : 102) : e > 0.12 ? 104 : e > 0.04 ? 106 : 22;
            if (e > 0.55 && e < 0.9 && ih(fl(x * 0.5), fl(wy * 0.25), 4573) < 0.06 * fall + 0.03) c = 118;
          } else c = e < 0.3 ? 22 : e < 0.6 ? 107 : e < 0.85 ? 105 : 103;
          BUF[row + x] = c;
        }
      }
    }
    const SVX = 236, SHZ = 138, SBX = 176;
    const a4Gap = (t) => 260 * eoc(lin(62.04, 62.9, t)) + 40 * lin(62.9, 64, t);
    shot(62.0, 62.6, (lt, t) => {
      const g = t - 62.0, gap = a4Gap(t), sky = 26 * eoc(lin(62.04, 62.7, t)), run = eoc(lin(62.0, 62.09, t));
      belowWorld(t, SHZ, 120 + t * 10, 0.85);
      a4Ceil(LB - 4, 34, 40, null, 1);
      a4Rock(40, 128, 214, 260, 4421, true);
      actor(HERO3({ eyes: 'wide', sword: 0.5, legs: [0, 0, 0, 0], mouth: 1 }), 86, 194, 1.25, 0.12 * sstep(0.25, 0.55, g), false, { still: true });
      a4Sunder(SVX, SHZ, SBX, gap, sky, run, t);
      // he is on the far side of the line, slid away with his half; the hand that cut it lies along its lip, lifting off it
      const lift = eio(lin(62.15, 62.6, t)), sl = gap * 0.42;
      a4Sund(392 + sl * 0.5, 62, 0.66, t, { third: 1, eyes: 1.4, heat: 0.9, crown: 0.75, rage: 0.4, nod: 2,
        arms: [a4Rest(-150, 150, 17, t), a4Rest(120, 170, 18, t), a4Rest(-86, 196, 19, t), { x: -150 + sl * 0.4 + lift * 30, y: 268 - lift * 40, pose: 'chop', ang: PI * 0.7 - lift * 0.4, front: true }] });
      // steam boiling up out of the whole length of it, and spray where the sea goes over
      for (let k = 0; k < 9; k++) { const q = 0.15 + 0.8 * ih(k, 1, 4552), y = lerp(SHZ + 4, H - LB, q), cx = lerp(SVX, SBX, (y - SHZ) / (H - LB - SHZ)), up = frac(ih(k, 2, 4552) + g * 0.9); cloudPuff(cx + (ih(k, 3, 4552) - 0.5) * 20 * q, y - up * (30 + 60 * q), (5 + up * 14) * (0.4 + q), [120, 121, 122, 123], 4553 + k); }
      rocks(SBX + 8, 230, g, 18, 300, 4, [97, 99, 122, 105], 4554, 220, -PI / 2, 1.2);
      rocks(SVX, SHZ + 6, g, 10, 90, 2, [97, 99, 122, 105], 4556, 120, -PI / 2, 1.2);
      // the cut itself: a line of white light the length of the world, then the light of the chasm on everything
      if (g < 0.1) { const k = 1 - g / 0.1; glow(SBX + 10, 200, 160 * k, T_WH, 0.7); lineF(SBX, H - LB, SVX, SHZ, (x, y) => { thick(x, y, x, y, 2, 22); }); lineP(SVX, SHZ, SVX + 2, LB, 22); }
      glow(SBX + 10, 230, 120, T_EMBER, 0.4 * eoc(lin(62.05, 62.4, t)));
      megaHit(SBX + 6, 238, g, 2.6, -PI / 2, [22, 106, 103], 4555);
      a4Cam(1 + 0.05 * g, -0.01 * g, 240, 135, kick(t, [[62.0, 3, PI / 2]]));
      shk(2 + 6 * Math.max(0, 1 - g * 2));
    });
    // close on the lip: across the chasm the far wall, the sea pouring over its edge; the slab under the hero tips out over
    // the drop and it goes with it
    shot(62.6, 63.0, (lt, t) => {
      const fall = eic(lin(62.72, 63.04, t)), tilt = eio(lin(62.6, 62.8, t)) * 0.3 + fall * 0.6, dropY = fall * 50;
      gradient(LB, 70, [98, 101, 102, 103]);
      a4Wall(1, -40, -70 - dropY, t, 0.7, 700, 4561, true);
      for (let k = 0; k < 3; k++) { const x = 60 + k * 150 + Math.sin(k * 2.7) * 24; a4Falls(x, 66 - dropY, H - LB, 16 + (k % 2) * 10, t, 4562 + k); }
      for (let x = 0; x < W; x++) for (let y = 62 - dropY; y < 68 - dropY; y++) if (y >= LB && ih(x, fl(y + t * 30), 4566) < 0.7) P(x, y, ih(x, y, 4567) < 0.3 ? 22 : 118);
      glow(300, H - LB, 220, T_EMBER, 0.5);
      // the slab: pivoting out over the drop about its outer lip
      const px = 262, py = 196 - dropY * 0.2, ca = Math.cos(tilt), sa = Math.sin(tilt);
      const R = (x, y) => [px + (x - px) * ca - (y - py) * sa, py + (x - px) * sa + (y - py) * ca + dropY];
      { const a = R(-60, py), b = R(px, py), c = R(px - 10, py + 120), d = R(-60, py + 120); z5Tri(a[0], a[1], b[0], b[1], c[0], c[1], 98); z5Tri(a[0], a[1], c[0], c[1], d[0], d[1], 99); thick(a[0], a[1], b[0], b[1], 2, 123); }
      const hp = R(226 + fall * 26, py - 34), hx = hp[0] + fall * 40, hy = hp[1] + fall * fall * 110;
      actor(HERO3({ eyes: 'wide', mouth: 2, sword: lerp(0.5, -1.6, fall), legs: fall > 0.1 ? z5Limp(t, 1) : [0, 0, 0, 0] }), hx, hy, 2.6, tilt * 0.8 + fall * 1.6, false, {});
      rocks(262, 196, t - 62.62, 12, 120, 3, [97, 99, 122, 105], 4564, 300, PI / 2, 2);
      a4Embers(t, 30, 50, 4565);
      shk(2.5);
      a4Cam(1.04, 0.04 * tilt, 240, 135 + fall * 14);
    });
  
    /* one of his arms seen close, at the engine's own fidelity: the muscled obsidian upper arm (glossy, veined with fire,
       rim-lit) running back off the frame, the elbow cop, the porcelain vambrace of three plates with fire in its gaps, and
       the jointed hand. (x, y) the wrist, a the forearm's direction, s the scale (local units like his), pose a preset name or
       a hand object; o: { bend (the elbow's turn, so the upper arm comes in from another angle), len (the forearm, units),
       ang (the hand's own angle; default a), hold, layer ('palm' draws the whole arm and the palm; 'fingers' only the
       fingers), side (thumb side), rim (0..1 the fire's light on its far side) }. Returns the hand's striking point (with
       .palm, .tip, .knuckles, .elbow) */
    function a4Fore(ex, ey, wx, wy, s, heat, rim) {
      limbF(ex, ey, wx, wy, (u) => s * (12.5 + u * 2.5), 16 * s, (u, sdn, lit, X, Y, e) => {
        if (u < 0.26) return obsLit(lit, X, Y, e, heat);
        const pf = (u - 0.26) / 0.74 * 3, fp = frac(pf);
        if (fp < 0.07 && u < 0.98) return heat > 0.25 ? (heat > 0.6 ? (Math.abs(sdn) < 0.5 ? 105 : 104) : 102) : 96;
        if (e > 0.9) return rim > 0.3 && lit < -0.2 ? 103 : 69;
        if (rim > 0.3 && lit < -0.45 && e > 0.72) return bay(X, Y) < rim ? 102 : 68;           // the fire's light on its far side
        if (Math.abs(sdn + 0.15) < 0.05 && fp > 0.25 && fp < 0.8) return 67;                     // an engraved line
        if (fp > 0.86 && Math.abs(sdn) < 0.8) return BONE4[clamp(fl(3.4 + lit * 2), 0, 5)];      // the plate's raised lip
        if (lit > 0.78 && fp > 0.2) return 64;                                                     // the gloss along its top
        return BONE4[clamp(fl(1.7 + lit * 3.3 + (bay(X, Y) - 0.5) * 0.9 - (fp < 0.18 ? 0.8 : 0)), 0, 5)];
      });
    }
    function a4Upper(ax, ay, ex, ey, s, heat, k) {
      limbF(ax, ay, ex, ey, (u) => s * (17 + 5 * Math.sin(PI * Math.min(1, (1 - u) * 1.25)) - (1 - u) * 4), 22 * s, (u, sdn, lit, X, Y, e) => {
        const vein = Math.abs(sdn - 0.35 * Math.sin(u * 9 + k)) < 0.05 && u > 0.1 && u < 0.9;
        return vein && heat > 0.25 ? (heat > 0.6 ? 104 : 103) : obsLit(lit, X, Y, e, heat);
      });
    }
    const a4P = (p) => { const q = poseOf(p); return { curls: q.curls ? q.curls.slice() : [0, 1, 2, 3].map(() => q.curl), thumb: q.thumb, spread: q.spread }; };
    // a pose between two poses (names or hand objects)
    const a4PL = (a, b, u) => { const A = a4P(a), B = a4P(b); u = clamp(u, 0, 1); return { curls: A.curls.map((c, i) => lerp(c, B.curls[i], u)), thumb: lerp(A.thumb, B.thumb, u), spread: lerp(A.spread, B.spread, u) }; };
    function a4Arm(x, y, s, a, pose, heat, t, o) {
      o = o || {};
      const len = (o.len || 76) * s, ex = x - Math.cos(a) * len, ey = y - Math.sin(a) * len, a2 = a + (o.bend === undefined ? 0.35 : o.bend);
      const ax = ex - Math.cos(a2) * 170 * s, ay = ey - Math.sin(a2) * 170 * s, rim = o.rim === undefined ? 0.6 : o.rim;
      if (o.layer !== 'fingers') {
        a4Upper(ax, ay, ex, ey, s, heat, o.k || 0);
        a4Fore(ex, ey, x, y, s, heat, rim);
        // the elbow cop: a porcelain plate over the joint, fire round its edge
        const cx_ = Math.cos(a) * 3 * s, cy_ = Math.sin(a) * 3 * s;
        capsF(ex - cx_, ey - cy_, ex + cx_, ey + cy_, 10 * s, 10 * s, () => (heat > 0.3 ? 102 : 96));
        limbF(ex - cx_, ey - cy_, ex + cx_, ey + cy_, () => 8.8 * s, 10 * s, (u, sdn, lit, X, Y, e) => e > 0.86 ? 69 : BONE4[clamp(fl(2.4 + lit * 2.4 + (bay(X, Y) - 0.5) * 0.9), 0, 5)]);
        limbF(x - 1, y - 1, x + 1, y + 1, () => 10 * s, 11 * s, (u, sdn, lit, X, Y, e) => obsLit(lit, X, Y, e, heat));
      }
      const h = Object.assign(a4P(pose), { heat, side: o.side || 1, hold: o.hold, layer: o.layer });
      const r = sHand(x, y, s, o.ang === undefined ? a : o.ang, h, t);
      r.elbow = [ex, ey];
      return r;
    }
    // lightning crawling over the last stamped sprite and out of it
    function a4Storm(x, y, S, t, amt, n) {
      for (let k = 0; k < (n || 3); k++) { const f = fl(t * 18), a0 = ih(k, f, 4601) * TAU, r0 = 6 * S, r1 = (12 + 10 * ih(k, f, 4602)) * S * amt; if (ih(k, f, 4603) > amt) continue; bolt(x + Math.cos(a0) * r0, y + Math.sin(a0) * r0, x + Math.cos(a0 + 0.5) * r1, y + Math.sin(a0 + 0.5) * r1, f + k * 7, 1, 91, 89); }
    }

    /* ============================================================== 4 · storm (63.0–66.0)
       It falls down the cut face, drives its sword into the rock and grinds to a stop; flares STORM FORM; leaps up the chasm
       as lightning, at his face — and he catches it out of the air like a fly, and smashes it into the wall. */
    const A4STAB = 63.12;
    const a4FallY = (t) => t < A4STAB ? (t - 63.0) * 620 : 74.4 + 520 * 0.38 * (1 - Math.pow(1 - clamp((t - A4STAB) / 0.38, 0, 1), 2)) / 2;
    shot(63.0, 64.2, (lt, t) => {
      const wy = a4FallY(t), cw = a4FallY(Math.min(t + 0.09, Math.max(t, A4STAB + 0.3))), oy = 300 + cw - 118, storm = t >= 63.6, g = t - 63.6, launch = eic(lin(64.08, 64.2, t));
      a4Deep(oy - 200, t, 1, 1400);
      a4Falls(70, LB, H - LB, 14, t, 4611);
      a4Wall(1, 330, oy, t, 1, 1400, 4612, true);
      if (t < A4STAB) streaks(-PI / 2, 40, t, 3000, 103, 60, 4613, [0, LB, W, H - 2 * LB]);
      // the scar its sword ploughed down the rock, still glowing
      const hsy = 118 + wy - cw; if (t >= A4STAB) { const y0 = hsy - (wy - 74.4); for (let y = Math.max(LB, fl(y0)); y < hsy; y++) { const q = (hsy - y) / Math.max(1, hsy - y0); P(322 + Math.sin(y * 0.7) * 0.8, y, q < 0.3 ? 106 : q < 0.7 ? 104 : 102); P(323, y, 101); P(321, y, 96); } }
      const crouch = storm ? eio(lin(63.7, 64.0, t)) * (1 - launch) : 0, hx = 290 - crouch * 8 - launch * 20, hy = hsy + 6 * crouch - launch * 150;
      const hang = t >= A4STAB && !storm ? Math.sin((t - A4STAB) * 9) * 0.06 * Math.exp(-(t - A4STAB) * 3) : 0;
      const sw = t < A4STAB - 0.06 ? -1.3 : t < A4STAB ? lerp(-1.3, 0.05, eoc((t - A4STAB + 0.06) / 0.06)) : launch > 0 ? lerp(0.05, -1.4, launch) : 0.05 + hang;
      const form = storm ? 'storm' : null, flick = storm && g < 0.25 && fl(g * 30) % 3 === 1;
      if (storm && g < 0.5) glow(hx, hy, 140 * (1 - g * 1.5), T_CYAN, 0.6);
      const a = heroForm(flick ? 'plain' : form || 'plain', { eyes: storm ? 'glow' : t < A4STAB + 0.4 ? 'closed' : 'wide', mouth: t > A4STAB && t < 63.5 ? 2 : storm ? 1 : 0, sword: sw, sq: crouch * 0.3 - launch * 0.2, legs: storm ? undefined : z5Limp(t, 1.2) }, hx, hy, 2.4, hang * 2 - launch * 0.5, false, {});
      if (storm) { a4Storm(hx, hy, 2.4, t, g < 0.4 ? 1 : 0.6, g < 0.4 ? 5 : 3); if (g < 0.3) for (let k = 0; k < 4; k++) bolt(hx, hy, hx + (ih(k, 1, 4614) - 0.5) * 300, hy - 60 - ih(k, 2, 4614) * 120, k + fl(t * 20), 2, 91, 89); }
      if (t >= A4STAB && t < A4STAB + 0.4) { const g2 = t - A4STAB; for (let k = 0; k < 14; k++) { const q = frac(ih(k, 1, 4615) + g2 * 4), x = a.tip[0] - 2 - q * 40 * ih(k, 2, 4615), y = a.tip[1] - q * 30 + q * q * 40; P(x, y, q < 0.4 ? 22 : 106); } glow(a.tip[0], a.tip[1], 30, T_EMBER, 0.6); }
      if (launch > 0) streaks(-PI / 2, 30, t, 3000, 91, 80, 4616, [0, LB, W, H - 2 * LB]);
      a4Embers(t, 26, storm ? 30 : 400, 4617);
      shk(t >= A4STAB && t < 63.3 ? 3 : storm && g < 0.3 ? 4 : 0.5);
      a4Cam(1.06, 0.02 * Math.sin(lt * 2), 240, 135, kick(t, [[A4STAB, 1.2, -PI / 2], [63.6, 1.5]]));
    });
    /* looking straight up the chasm: its two walls rise on either side and converge (in perspective) on a narrow slit of fire
       and dawn far overhead. Wall texels are the chasm's own rock, laid out by height (h ~ 1 / distance from the slit), so its
       strata run parallel to the slit and crowd together toward it; far rock drowns in the haze of the cut's light; oyy
       scrolls the walls past (a rise up them). The slit is a little wider at the bottom of the frame (its nearer end). */
    function a4Up(t, slitW, oyy, heat) {
      heat = heat === undefined ? 1 : heat;
      for (let y = LB; y < H - LB; y++) {
        const q = (y - LB) / (H - 2 * LB), cx = 240 + Math.sin(q * 3 + 0.4) * 8 + (vn(y, 0, 7, 4641) - 0.5) * 5, half = slitW * (0.32 + 0.5 * q), row = y * W;
        for (let x = 0; x < W; x++) {
          const dx = x - cx, d = Math.abs(dx) - half - (vn(y, dx < 0 ? 1 : 2, 4, 4642) - 0.5) * 3;
          if (d < 0) {
            // the slit: molten lips, then the burning air of the cut, and the dawn beyond it at the middle
            const e = Math.abs(dx) / Math.max(1, half), b = bay(x, y), sm = vn(x * 0.7, y - t * 30, 6, 4645);
            BUF[row + x] = e > 0.8 ? (b < 0.5 ? 104 : 105) : sm > 0.7 ? (sm > 0.8 ? 104 : 105) : e > 0.45 ? (b < 0.6 ? 106 : 105) : b < 0.5 ? 16 : 107;
            continue;
          }
          const hh = 1600 / (d + half * 0.7 + 6), far = clamp(hh / 110, 0, 1), wy = fl(oyy * 2 + (4000 - hh) * 4);
          const u = fl((y - 135) * hh / 30), tx = ((u % W) + W) % W, R = a4TexRow(dx < 0 ? 4643 : 4644, wy);
          let c = a4Lit(R[dx < 0 ? tx : W - 1 - tx], x, y, heat * (0.1 + 0.9 * far * far), 0.15 + 0.4 * far, fl(far * 3 - 1.6));
          // the lips of the walls, lit by the slit; the haze of its light on the far rock
          if (d < 1.5) c = 104; else if (d < 3.5) c = ((x + y) & 1) === 0 ? 103 : 102;
          else if (bay(x, y) < far * far * far * 0.85) c = far > 0.85 ? 103 : 102;
          BUF[row + x] = c;
        }
      }
      glow(240, LB + 10, 120, T_EMBER, 0.25 * heat);
    }
    const A4TC = 64.55;                                                     // the bolt meets his palm
    // the storm hero held in his hand (drawn inside it, between the palm and the closing fingers): squeezed, thrashing,
    // its lightning bursting out round the fingers and dying
    function a4Caught(info, t, g, S, amt) {
      const [px, py] = info.palm, vx = info.uy, vy = -info.ux, o = info.s * 11, hx = px + info.ux * 2 * info.s + vx * o + z5Sh(t, 3) * 1.6 * amt, hy = py + info.uy * 2 * info.s + vy * o + z5Sh(t * 1.3, 5) * 1.2 * amt;
      const sq = Math.min(0.5, g * 4) * (0.7 + 0.3 * Math.sin(t * 9)), kick = (k) => clamp(1.5 + Math.sin(t * 17 + k * 1.9) * 1.5 * amt, 0, 3);
      const st = g < 0.12 || (amt > 0.45 && fl(t * 20) % 3 === 0) ? 'storm' : 'plain';
      heroForm(st, { eyes: g < 0.12 || fl(t * 6) % 3 === 0 ? 'wide' : 'closed', mouth: 2, sword: -2.3 + z5Sh(t, 4) * 0.5 * amt, sq: -0.3 * sq, legs: [0, 1, 2, 3].map(kick), cracks: 0.1 + 0.25 * Math.min(1, g * 2) }, hx, hy, S, Math.atan2(vy, vx) + PI / 2 + Math.sin(t * 11) * 0.15 * amt, false, { still: true });
      return [hx, hy];
    }
    shot(64.2, 64.6, (lt, t) => {
      const u = eic(lin(64.2, A4TC, t)), hand = eoc(lin(64.28, 64.5, t)), g = t - A4TC, close = eoc(lin(A4TC - 0.02, A4TC + 0.1, t));
      a4Up(t, 26, t * 200);
      // his face over the slit, watching it come; he leans in as the hand goes down
      a4Sund(240, 44 - hand * 4, 0.85, t, { third: 1, eyes: 1.6, heat: 0.9, crown: 0.75, body: false, nod: 2 + hand * 2, tilt: -0.05 * hand });
      // the hand: down into the slit, open, fingers splayed (the claw), braced; it takes the bolt and the fingers snap shut
      const wx = 254 + z5N(t * 2, 3) * 3, wy = lerp(-90, 44, hand) - z5Knock(g, 10, 16, 6) + (1 - hand) * 0, fa = PI / 2 + 0.15 - 0.1 * hand;
      const palmY = wy + Math.sin(fa) * 5.5 * 2.4, palmX = wx + Math.cos(fa) * 5.5 * 2.4;
      // the bolt it has become: a white-blue streak from the depths, its head the hero, homing on the palm
      if (g < 0) {
        const hy = lerp(300, palmY + 16, u), hx = lerp(240, palmX, u) + Math.sin(u * 7) * 14 * (1 - u), S = lerp(2.6, 1.3, u);
        bolt(hx, hy, 240 + Math.sin(u * 3) * 30, H - LB + 10, fl(t * 30), 3, 22, 90, 0.3);
        bolt(hx, hy, 240 - Math.sin(u * 5) * 40, H - LB + 10, fl(t * 30) + 9, 1, 91, 89, 0.4);
        glow(hx, hy, 50, T_CYAN, 0.7);
        heroForm('storm', { eyes: 'glow', mouth: 2, sword: -1.5, sq: -0.35 }, hx, hy, S, -PI / 2 + 0.2, false, { still: true });
        a4Storm(hx, hy, S, t, 1, 4);
      }
      if (hand > 0) a4Arm(wx, wy, 2.4, fa, a4PL({ curl: 0.18, thumb: 0.1, spread: 1 }, { curl: 0.8, thumb: 0.7, spread: 0.2 }, close), 0.85, t, { bend: -0.5, side: -1,
        hold: g >= 0 ? (info) => { a4Caught(info, t, g, 1.3, 1); } : undefined });
      if (g >= 0) { glow(palmX, palmY, 70, T_CYAN, 0.6); for (let k = 0; k < 6; k++) { const a = PI / 2 + (k - 2.5) * 0.5; bolt(palmX, palmY, palmX + Math.cos(a) * 70, palmY + Math.sin(a) * 50, fl(t * 30) + k, 1, 91, 89); } }
      shk(1 + u * 2);
      a4Cam(1.02 + u * 0.06, 0, 240, 135);
    });
    // the catch, close: the fist shut on the hero, its lightning bursting out between the fingers and dying as it squeezes;
    // the hero thrashes inside; then he draws it back on an arc (the whole arm winding up), and swings
    shot(64.6, 65.2, (lt, t) => {
      const g = t - A4TC, back = eio(lin(64.8, 65.1, t)), swing = eic(lin(65.1, 65.2, t));
      a4Up(t, 40, t * 120, 0.9);
      tintAll(T_DARK, 0.2);
      // the wrist on an arc: settles from the catch, drawn back and up, then hurled down and left
      const fx = 250 + back * 80 - swing * 430 + z5Sh(t, 2) * 1.5 * (1 - back), fy = 176 - Math.sin(back * PI * 0.5) * 50 + swing * 40 + z5Knock(g - 0.05, 10, 16, 5);
      const fa = -0.4 - back * 0.5 + swing * 0.9, s = 3.4 - back * 0.3;
      const amt = Math.max(0, 1 - g * 1.5), squeeze = Math.min(1, g * 2.5);
      let held = null;
      const r = a4Arm(fx, fy, s, fa, a4PL({ curl: 0.7, thumb: 0.6, spread: 0.2 }, { curl: 0.86, thumb: 0.8, spread: 0 }, squeeze * (0.85 + 0.15 * Math.sin(t * 13))), 0.9, t, { bend: 0.5 + back * 0.4, side: -1,
        hold: (info) => { held = a4Caught(info, t, g, 2.5, amt); } });
      // its lightning, forced out between the fingers, weaker with every squeeze
      const [hx, hy] = held;
      for (let k = 0; k < 7; k++) if (ih(k, fl(t * 20), 4621) < amt + 0.1) { const a = fa - PI * 0.6 + (k / 6) * PI * 1.2, L = 30 + 90 * amt * ih(k, 2, 4621); bolt(hx, hy, hx + Math.cos(a) * L, hy + Math.sin(a) * L * 0.8, fl(t * 20) + k, k % 3 ? 1 : 2, 91, 89); }
      glow(hx, hy, 60 * amt + 14, T_CYAN, 0.22 * amt + 0.05);
      if (swing > 0) { streaks(PI - 0.1, 34, t, 4000, 66, 140, 4622, [0, LB, W, H - 2 * LB]); smearArc(fx + 300, fy - 200, PI * 0.6, PI * 0.6 + swing * 0.6, 340, [96, 98, 66]); }
      z5Hit(r.palm[0], r.palm[1], g, 1.4, -PI / 2, 91, 4623);
      shk(g < 0.3 ? 5 * (1 - g / 0.3) : swing > 0 ? 3 : 1.2);
      a4Cam(1.0 + 0.04 * back, -0.03 * back + 0.06 * swing, 240, 135, kick(t, [[64.6, 2.2, -PI / 2]]));
    });
    WHIPS.push([65.17, PI]);
    // the slam: side on, the fist with the hero in it drives into the chasm wall; rock bursts; it holds it there, grinding;
    // then the fingers open and the hand draws away and leaves it in the crater, its storm going out; it slides out and drops
    shot(65.2, 66.0, (lt, t) => {
      const g = t - 65.2, open = eoc(lin(65.42, 65.56, t)), away = eio(lin(65.5, 65.85, t)), slide = eic(lin(65.78, 66.0, t));
      a4Deep(500, t, 0.8, 1400);
      a4Wall(-1, 190, 520, t, 0.8, 1400, 4631, true);
      // the crater: a dish of shattered rock, its rim burning, cracks running out of it
      const cx = 194, cy = 140, cr = 46 * eoc(Math.min(1, g * 8)), S = 2.5;
      if (g > 0) {
        for (let k = 0; k < 14; k++) { const a = k / 14 * TAU + ih(k, 1, 4632), L = cr + 30 + ih(k, 2, 4632) * 90 * Math.min(1, g * 5); let x = cx, y = cy; for (let q = 0; q < 6; q++) { const nx = x + Math.cos(a + (ih(k, q, 4633) - 0.5) * 0.8) * L / 6, ny = y + Math.sin(a + (ih(k, q, 4633) - 0.5) * 0.8) * L / 6; if (Math.hypot(nx - cx, ny - cy) > cr * 0.9) { lineP(x, y, nx, ny, q < 2 ? 104 : 102); lineP(x + 1, y, nx + 1, ny, 96); } x = nx; y = ny; } }
        for (let y = fl(cy - cr); y < cy + cr; y++) for (let x = fl(cx - cr); x < cx + cr * 0.3; x++) { const d = Math.hypot((x - cx) / cr, (y - cy) / cr); if (d < 1) P(x, y, d > 0.86 ? (bay(x, y) < 0.5 ? 104 : 102) : d > 0.6 ? (x < cx - cr * 0.3 ? 98 : 97) : 96); }
      }
      // the hand: it arrives already shut on the hero (the blow lands on the frame), shudders against the rock, opens, goes
      const hx0 = cx + 13 * S - 2, push = z5Knock(g, -9, 20, 7), grind = (1 - open) * z5Sh(t, 4) * 1.8;
      const fs = 3.2, fa = PI + 0.08, wx = hx0 + 30 + 5.5 * fs + push + grind + 330 * away * away + 80 * away, wy = cy + 4 - 30 * away + grind * 0.5;
      const held = open < 0.35;
      const hx = held ? 0 : hx0 + 3 * open + slide * 20, hy = cy + slide * slide * 120;
      const drawHero = (x, y, sq) => {
        const fz = g > 0.15 && g < 0.6 ? fl(t * 15) % 3 : 1;
        heroForm(fz === 0 && away < 1 ? 'storm' : 'plain', { eyes: 'closed', mouth: g < 0.5 ? 2 : 0, sword: lerp(-2.4, 1.2, slide), sq, legs: z5Limp(t, 1.5), cracks: 0.25 }, x, y, S, -0.3 + slide * 1.2, false, { still: true });
        if (fz === 0 && away < 1) a4Storm(x, y, S, t, 0.5, 2);
      };
      if (!held) drawHero(hx, hy, lerp(-0.35, 0, away));
      if (away < 1) a4Arm(wx, wy, fs, fa, a4PL({ curl: 0.92, thumb: 0.85, spread: 0 }, { curl: 0.15, thumb: 0.1, spread: 0.9 }, open), 0.8, t, { bend: -0.25, rim: 0.8,
        hold: held ? () => drawHero(hx0 + z5Sh(t, 6) * 0.8, cy, -0.35 - 0.2 * Math.exp(-g * 8)) : undefined });
      rocks(cx + 10, cy, g, 30, 340, 5, [97, 99, 122, 105], 4634, 260, 0, 1.7);
      megaHit(cx, cy, g, 2.6, 0, [22, 106, 103], 4635);
      if (g > 0 && g < 0.35) for (let k = 0; k < 10; k++) { const a = -PI / 2 + (ih(k, 1, 4637) - 0.5) * 2.6, q = (g + ih(k, 2, 4637) * 0.1) * 3, x = cx + 4 + Math.cos(a) * 120 * q, y = cy + Math.sin(a) * 90 * q + 140 * q * q; if (q < 1) P(x, y, q < 0.4 ? 22 : 106); }
      a4Embers(t, 20, -30, 4636);
      a4Cam(1.04, 0.02, 240, 135, kick(t, [[65.2, 3, PI]]));
      shk(g < 0.4 ? 8 * (1 - g / 0.4) : open < 1 ? 1.5 : 0.5);
    });
  
    /* ============================================================== 5 · the beating (66.0–72.0)
       Fable Mode, gold, guard up, everything it has left. A straight punch: the guard holds, the knees go. A hammer-fist: the
       guard breaks and the sword cracks. Three body blows — a hook, an uppercut, a downward drive — it folds round each one.
       It hits the ledge. It tries to get up. He puts his hand on it and presses it into the rock. */
    // a ledge of the chasm wall to stand on: its top at y (a little uneven), rubble, cracks
    // a ledge of the chasm wall to stand on: its lip lit (ash-pale, or by the fire), a band of rubble along it, the cut face
    // of the rock below in the chasm's own lit strata
    function a4Ledge(top, ox, t, lit) {
      for (let x = 0; x < W; x++) {
        const wx = x + ox, y0 = top + (vn(wx, 0, 30, 4701) - 0.5) * 6 + (vn(wx, 0, 6, 4703) - 0.5) * 2, tx = ((fl(wx) % W) + W) % W;
        for (let y = Math.max(LB, fl(y0)); y < H - LB; y++) {
          const d = y - y0, b = bay(x, y);
          let c;
          if (d < 1.2) c = lit ? 123 : 122;
          else if (d < 3.2) c = vn(wx, y, 3, 4704) > 0.45 ? (lit ? 122 : 121) : 100;
          else if (d < 6) c = b < 0.5 ? 121 : 99;
          else c = a4Lit(a4TexRow(4702, fl(y * 1.3 + 900))[tx], x, y, lit ? 0.3 : 0.12, 0.25, d < 14 ? 0 : d > 40 ? -2 : -1);
          BUF[y * W + x] = c;
        }
      }
      // rubble along the lip: stones lit on top
      for (let k = 0; k < 26; k++) { const x = ((ih(k, 1, 4705) * 640 - ox) % 640 + 640) % 640 - 80, r = 1 + ih(k, 2, 4705) * 3.2, y = top - r * 0.5 + (vn(x + ox, 0, 30, 4701) - 0.5) * 6; discF(x, y, r, 98); discF(x - r * 0.3, y - r * 0.35, r * 0.55, lit ? 122 : 121); }
    }
    function a4Dust(x, y, g, n, spread, seed, cols) {
      if (g < 0 || g > 1) return;
      cols = cols || [122, 121, 120];
      for (let k = 0; k < n; k++) { const a = PI + ih(k, 1, seed) * PI, v = spread * (0.4 + ih(k, 2, seed)), px = x + Math.cos(a) * v * eoc(g), py = y + Math.sin(a) * v * 0.35 * eoc(g) - g * 10, r = (2 + ih(k, 3, seed) * 4) * (0.5 + g); for (let q = 0; q < r * r * 3; q++) { const dx = (ih(k, q, seed + 1) - 0.5) * 2 * r, dy = (ih(k, q, seed + 2) - 0.5) * 2 * r * 0.7; if (dx * dx + dy * dy * 2 < r * r && bay(fl(px + dx), fl(py + dy)) > g) P(px + dx, py + dy, cols[(q + k) % 3]); } }
    }
    // hit-stop: the clock of a shot held for d after each hit
    const a4Stop = (t, hits, d) => { let o = t; for (const h of hits) o -= clamp(t - h, 0, d); return o; };
    // cracks across a held sword, from the hand to the tip (amt 0..1)
    function a4SwordCracks(hand, tip, amt, seed) {
      if (amt <= 0) return;
      const dx = tip[0] - hand[0], dy = tip[1] - hand[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      for (let k = 0; k < 4; k++) { if (ih(k, 1, seed) > amt) continue; const u = 0.3 + k * 0.16, px = hand[0] + dx * u, py = hand[1] + dy * u, w = L * 0.08; lineP(px - nx * w, py - ny * w, px + nx * w + dx * 0.03, py + ny * w + dy * 0.03, 96); P(px, py, 22); }
    }
    const A4GRD = 214;
    // a screen point → his local units (for putting a wrist exactly where a blow must land), his mask at M, scale s
    const a4Loc = (M, s, t, X, Y) => [(X - M[0]) / s, (Y - M[1] - Math.sin(t * 0.9) * s) / s];
    // where to put the wrist so the striking point of a hand (knuckles, scale s·fs, pointing a) lands on (kx, ky)
    const a4Wr = (kx, ky, a, s) => [kx - Math.cos(a) * 10.8 * s, ky - Math.sin(a) * 10.8 * s];
    // an arm between blows: never still — it drifts, and its fingers flex
    const a4Rest = (x, y, k, t, pose) => ({ x: x + z5N(t * 0.8, k) * 6, y: y + z5N(t * 0.7, k + 3) * 5, pose: a4PL(pose || 'fist', 'grab', 0.35 + 0.35 * z5N(t * 1.4, k + 7)) });
    // 66.0–67.0 the punch, side on: he is a mountain at the right; he cocks his upper arm back behind his shoulder (leaning
    // away), and drives it straight through the guard — the knuckles meet the hilt on the hit frame; the guard holds, the
    // fist rides on through with the skid, and he settles back
    shot(66.0, 67.0, (lt, t) => {
      const T = a4Stop(t, [66.6], 0.07), g = t - 66.6, wind = eio(lin(66.0, 66.42, T)), strike = eic(lin(66.42, 66.6, T)), rec = eio(lin(66.72, 67.0, T));
      a4Deep(260, t, 0.7, 1200);
      a4Wall(-1, 30, 280, t, 0.6, 1200, 4711, false);
      a4Ledge(A4GRD, 0, t, true);
      const sk = g > 0 ? eoc(Math.min(1, (T - 66.6) / 0.36)) : 0, skid = 64 * sk, S = 2.4, hx = 188 - skid, hy = A4GRD - 14 * S;
      const C = [hx + 15 * S + 2, hy - 3 * S];                          // its guard: the hilt, the sword held up before it
      const buckle = g > 0 ? 0.22 * sstep(0.08, 0.3, g) + z5Knock(g - 0.08, 0.2, 13, 4) : 0, tr = g > 0 ? a4Tw(t, 5) * 0.8 : 0;
      const flare = 1 + 0.6 * sstep(66.0, 66.4, t) * (1 - strike);
      // the blow lands along it: crushed narrow for two frames, then the knees go
      const sq = g > 0 ? (T - 66.6 < 0.001 ? -0.38 : -0.38 * Math.exp(-(T - 66.6) * 14) + buckle) : 0;
      heroForm('gold', { eyes: g > 0 && g < 0.25 ? 'closed' : 'angry', mouth: g > 0 ? 2 : 1, sword: -1.32 - (g > 0 ? z5Knock(g, 0.35, 16, 6) : 0) + tr * 0.03, sq, reach: 1, legs: g > 0 ? [0, 1.5 * sstep(0, 0.3, g), 1.5 * sstep(0, 0.3, g), 0] : undefined }, hx + tr, hy + Math.max(0, sq) * 8, S, -0.08 - (g > 0 ? z5Knock(g, 0.2, 14, 5) : 0), false, {});
      if (flare > 1.05) glow(hx, hy, 50 * flare, T_GOLD, 0.25 * (flare - 1) * 2);
      // the fist: rest → cocked high behind → straight in (a slight downward arc) → on with the skid → back
      const M = [446, 44], s = 1.5, fs = 1.3, a = PI - 0.05;
      const K0 = [C[0] + 130, C[1] - 24], K1 = [C[0] + 205, C[1] - 70];
      let kx, ky;
      if (g <= 0) { kx = lerp(lerp(K0[0], K1[0], wind), C[0], strike); ky = lerp(lerp(K0[1], K1[1], wind), C[1], strike) - Math.sin(strike * PI) * 10; }
      else { kx = lerp(C[0] - 4 * sk, K0[0] + 10, rec); ky = lerp(C[1] + 3 * sk, K0[1] - 6, rec); }
      const [wx, wy] = a4Wr(kx, ky, a, s * fs), [lx, ly] = a4Loc(M, s, t, wx, wy);
      a4Sund(M[0], M[1], s, t, { third: 1, eyes: 1.25 + 0.4 * strike * (1 - rec), heat: 0.85, crown: 0.75, rage: 0.2 + 0.3 * strike * (1 - rec), lean: 10 * wind * (1 - strike) - 16 * strike * (1 - rec), tilt: -0.07 * wind * (1 - strike) + 0.05 * strike, nod: -2 * wind * (1 - strike) + 3 * strike * (1 - rec),
        arms: [{ x: lx, y: ly, pose: 'fist', ang: a + 0.3 * wind * (1 - strike), front: true, fs }, a4Rest(112, 156, 1, t), a4Rest(-66, 206, 2, t), a4Rest(80, 200, 3, t)] });
      if (g > 0) { megaHit(C[0], C[1], g, 1.7, PI, [22, 59, 58], 4715); z5Hit(C[0], C[1], g, 1.3, PI, 59, 4712); a4Dust(hx - 10, A4GRD, g, 6, 50, 4713); for (let k = 0; k < 2; k++) lineP(hx - 30 - skid * 0.2 * k, A4GRD - 1 + k, hx - 6, A4GRD - 1 + k, 123); }
      if (strike > 0.2 && strike < 1) streaks(PI, 24, t, 3200, 66, 120, 4714, [0, hy - 40, W, 80]);
      shk(g > 0 && g < 0.4 ? 6 * (1 - g / 0.4) : 0.4);
      a4Cam(1.03, 0, 240, 135, kick(t, [[66.6, 2, PI]]));
    });
    // 67.0–67.75 the hammer-fist, from below: he raises his right fist high over his head (rising onto it, leaning back) and
    // brings it down on the sword held across its guard; the knuckles meet the blade on the hit frame; the guard breaks, the
    // fist goes on down onto its head, and he lifts it away
    shot(67.0, 67.75, (lt, t) => {
      const T = a4Stop(t, [67.4], 0.08), g = t - 67.4, raise = eio(lin(67.0, 67.2, T)), down = eic(lin(67.2, 67.4, T)), lift = eio(lin(67.5, 67.75, T));
      a4Deep(400, t, 0.6, 1200);
      a4Ledge(220, 40, t, true);
      const S = 3.0, broke = g > 0, hx = 214 + (broke ? z5Knock(g, -6, 12, 5) : a4Tw(t, 2) * 0.6), hy = 220 - 14 * S + (broke ? 10 * sstep(0, 0.2, g) + z5Knock(g, 8, 14, 5) : 0);
      const sw = broke ? lerp(-1.2, 1.15, eoc(Math.min(1, g / 0.12))) + z5Knock(g - 0.12, 0.2, 14, 5) : -1.2 + Math.sin(t * 20) * 0.02;
      const sq = broke ? (g < 0.06 ? 0.5 : 0.42 * sstep(0, 0.15, g) + z5Knock(g - 0.06, 0.12, 16, 6)) : 0.05;
      const a = heroForm(g > 0.25 && fl(t * 15) % 4 === 0 ? 'plain' : 'gold', { eyes: broke ? (g < 0.3 ? 'closed' : 'wide') : 'angry', mouth: broke ? 2 : 1, sword: sw, sq, reach: broke ? 3 : 1, legs: broke ? [1, 3, 3, 0] : undefined, cracks: broke ? 0.2 : 0 }, hx, hy, S, broke ? 0.12 : -0.05, false, {});
      if (broke) a4SwordCracks(a.hand, a.tip, Math.min(1, g * 6), 4721);
      // the contact: the blade 60% of the way up, where it is held across the guard (the pose before the break)
      const Kc = [214 + 15 * S + Math.cos(-1.2) * 18 * S, 220 - 14 * S - 2 * S + Math.sin(-1.2) * 18 * S], fa = PI / 2 + 0.08;
      const kx = Kc[0] + 40 * raise * (1 - down) + (broke ? -6 * sstep(0, 0.2, g) : 0), ky = lerp(Kc[1] - 40 - 70 * raise, Kc[1], down) + (broke ? 26 * eoc(Math.min(1, g / 0.15)) - 150 * lift : 0);
      const M = [404, -54], s = 1.6, fs = 1.3, [wx, wy] = a4Wr(kx, ky, fa, s * fs), [lx, ly] = a4Loc(M, s, t, wx, wy);
      a4Sund(M[0], M[1], s, t, { third: 1, eyes: 1.3 + 0.4 * down, heat: 0.85, crown: 0.75, core: 1, rage: 0.3 * down, lean: 8 * raise * (1 - down) - 14 * down * (1 - lift), nod: -3 * raise * (1 - down) + 4 * down * (1 - lift), tilt: 0.05 * raise - 0.08 * down,
        arms: [null, { x: lx, y: ly, pose: 'fist', ang: fa - 0.5 * raise * (1 - down), front: true, fs }, null, a4Rest(96, 196, 6, t)] });
      if (down > 0.3 && down < 1) streaks(PI / 2, 26, t, 3600, 66, 110, 4722, [kx - 70, LB, 140, H - 2 * LB]);
      if (broke) { z5Hit(Kc[0], Kc[1], g, 1.6, PI / 2 + 0.4, 59, 4723); for (let k = 0; k < 8; k++) { const q = g * 2, x = a.tip[0] - 20 + (ih(k, 1, 4724) - 0.5) * 120 * q, y = a.tip[1] - 30 * q + 90 * q * q; if (q < 1) sparkle(x, y, 1.5, 22, 34); } a4Dust(hx, 220, g, 8, 70, 4725); megaHit(Kc[0], Kc[1], g, 1.9, PI / 2, [22, 59, 58], 4726); }
      shk(broke && g < 0.4 ? 7 * (1 - g / 0.4) : 0.4);
      a4Cam(1.05, -0.06, 240, 128, kick(t, [[67.4, 2.4, PI / 2]]));
    });
    // 67.75–68.4 a hook from the left into its side: the arm swings in on a wide arc (the elbow out, then whipping straight),
    // the knuckles sink into its side on the hit frame; it folds round the fist and is thrown along the ledge; the fist
    // follows through and is drawn back
    shot(67.75, 68.4, (lt, t) => {
      const T = a4Stop(t, [68.1], 0.08), g = T - 68.1, hitv = t >= 68.1, wind = eio(lin(67.75, 67.98, T)), strike = eic(lin(67.98, 68.1, T));
      a4Deep(520, t, 0.5, 1200);
      a4Wall(1, 470, 540, t, 0.5, 1200, 4731, false);
      a4Ledge(200, 90, t, false);
      const S = 2.7, fold = hitv ? eoc(Math.min(1, g / 0.06)) : 0, fly = hitv ? eoc(Math.min(1, g / 0.42)) : 0;
      const hx = 190 + 150 * fly + a4Tw(t, 7) * (hitv ? 0 : 0.6), hy = 200 - 14 * S + 4 - Math.sin(fly * PI) * 40 + (hitv ? 0 : 4);
      heroForm(hitv ? 'plain' : 'gold', { eyes: hitv ? 'closed' : 'wide', mouth: 2, sword: hitv ? lerp(1.0, 2.2, fly) : 1.0, sq: hitv ? (g < 0.001 ? -0.5 : -0.45 * fold * (1 - fly * 0.7) + 0.15 * Math.sin(fly * PI)) : 0.3, reach: 3, legs: z5Limp(t, 1.5), cracks: 0.25 + 0.1 * fold }, hx, hy, S, hitv ? 0.5 * fold + fly * 1.2 : 0.1, false, {});
      // contact: its left side, a little below the middle
      const C = [190 - 13 * S * (hitv ? 0.75 : 1) + 2, 200 - 14 * S + 4 + 3 * S], fa = -0.1 + 0.25 * (1 - strike);
      let kx, ky;
      if (!hitv) { kx = lerp(lerp(C[0] - 110, C[0] - 140, wind), C[0], strike); ky = lerp(lerp(C[1] + 40, C[1] + 66, wind), C[1], strike) + Math.sin(strike * PI) * 20; }
      else { const ft = eoc(Math.min(1, g / 0.18)), rec = eio(lin(0.22, 0.3, g)); kx = lerp(C[0] + 70 * ft, C[0] - 160, rec); ky = lerp(C[1] - 10 * ft, C[1] + 60, rec); }
      a4Arm(kx - Math.cos(fa) * 10.8 * 2.5, ky - Math.sin(fa) * 10.8 * 2.5, 2.5, fa, 'fist', 0.9, t, { bend: lerp(1.1, 0.35, strike) + (hitv ? 0.2 * sstep(0.2, 0.3, g) : 0), side: 1 });
      if (strike > 0.2 && !hitv) streaks(0, 22, t, 3400, 66, 120, 4732, [0, ky - 40, W, 80]);
      const gr = t - 68.1;
      if (hitv) { megaHit(C[0], C[1], gr, 1.8, 0, [22, 37, 35], 4735); z5Hit(C[0], C[1], gr, 1.5, 0, 37, 4733); a4Dust(190, 200, gr, 6, 60, 4734); }
      shk(hitv && g < 0.4 ? 7 * (1 - g / 0.4) : 0.4);
      a4Cam(1.04, -0.03, 240 + 30 * fly, 135, kick(t, [[68.1, 2.2, 0]]));
    });
    // 68.4–69.0 an uppercut from under it, looking up the chasm: the fist comes up out of the depth, the knuckles meet its
    // belly on the hit frame, it folds flat over them, then stretches as it is thrown up the chasm; the fist rides up after
    // it and falls away
    shot(68.4, 69.0, (lt, t) => {
      const T = a4Stop(t, [68.7], 0.08), g = T - 68.7, hitv = t >= 68.7, strike = eic(lin(68.5, 68.7, T)), up = hitv ? eoc(Math.min(1, g / 0.3)) : 0, camY = 70 * eio(lin(68.7, 69.0, T));
      a4Up(t, 30 + camY * 0.2, t * 60 - camY, 0.8);
      const S = 2.6, hx = 238 + Math.sin(lt * 3) * 3, hy = lerp(150, 168, eio(lin(68.4, 68.7, T))) - 200 * up + camY;
      const sq = hitv ? (g < 0.001 ? 0.55 : g < 0.06 ? 0.45 : -0.35 * Math.exp(-(g - 0.06) * 5)) : 0;
      heroForm('plain', { eyes: hitv ? 'closed' : 'wide', mouth: 2, sword: 2.0 + (hitv ? 1.0 * up : 0), sq, reach: 3, legs: z5Limp(t, 2), cracks: 0.35 }, hx, hy, S, hitv ? -0.3 - 2.4 * up : 0.6, false, {});
      const C = [hx - 4, hy + 8 * S * (1 - 0.4 * Math.max(0, sq)) - 2], fa = -PI / 2 + 0.06;
      const ky = hitv ? C[1] - 16 * eoc(Math.min(1, g / 0.12)) + 260 * eic(lin(0.18, 0.3, g)) : lerp(H + 70, C[1], strike), kx = hitv ? C[0] : C[0] + (1 - strike) * 30;
      a4Arm(kx - Math.cos(fa) * 10.8 * 2.4, ky - Math.sin(fa) * 10.8 * 2.4, 2.4, fa, 'fist', 0.95, t, { bend: 0.25, side: -1 });
      if (strike > 0.2 && !hitv) streaks(-PI / 2, 24, t, 3600, 66, 120, 4741, [kx - 60, LB, 120, H - 2 * LB]);
      const gr = t - 68.7;
      if (hitv) { megaHit(C[0], C[1], gr, 1.8, -PI / 2, [22, 37, 35], 4744); z5Hit(C[0], C[1], gr, 1.6, -PI / 2, 37, 4742); for (let k = 0; k < 6; k++) { const q = g * 2.5, x = hx + (ih(k, 1, 4743) - 0.5) * 70 * q, y = hy + 10 - 60 * q + 120 * q * q; if (q < 1) rectF(x, y, 2, 2, k % 2 ? 37 : 22); } }
      shk(hitv && g < 0.4 ? 7 * (1 - g / 0.4) : 0.4);
      a4Cam(1.06, 0, 240, 135, kick(t, [[68.7, 2.4, -PI / 2]]));
    });
    // 69.0–70.0 at the top of its arc his upper-left fist comes down on it from above and to the right (he leans into it),
    // the knuckles on its back on the hit frame; it is thrown down on the ledge so hard the rock breaks; it bounces once
    shot(69.0, 70.0, (lt, t) => {
      const T = a4Stop(t, [69.3, 70.0], 0.07), g = T - 69.3, hitv = t >= 69.3, wind = eio(lin(69.0, 69.16, T)), strike = eic(lin(69.14, 69.3, T)), fall = hitv ? eic(Math.min(1, g / 0.62)) : 0;
      const camY = 70 * (1 - eio(lin(69.0, 69.85, t)));
      a4Deep(500 + camY, t, 0.6, 1200);
      a4Wall(-1, 40, 520 + camY, t, 0.6, 1200, 4751, false);
      a4Ledge(222 + camY * 0.2, 60, t, true);
      const S = 2.3, ax = 236, ay = 70 + camY, gx = 150, gy = 222 + camY * 0.2 - 14 * S * 0.6;
      const pre = eio(lin(69.0, 69.3, T)), hx = hitv ? lerp(ax, gx, fall) : lerp(250, ax, pre), hy = hitv ? lerp(ay, gy, fall) : lerp(90 + camY, ay, pre) - Math.sin(pre * PI) * 6;
      const land = T - 69.93, bounce = land > 0 ? Math.abs(Math.sin(Math.min(land, 0.3) / 0.3 * PI)) * 12 * Math.exp(-land * 3) : 0;
      const sq = land > 0 ? 0.55 * Math.exp(-land * 4) + 0.3 : hitv ? (g < 0.001 ? 0.45 : -0.3) : 0;
      heroForm('plain', { eyes: 'closed', mouth: hitv && land < 0 ? 2 : 0, sword: 2.4, sq, reach: 3, legs: land > 0 ? [3, 3, 3, 3] : z5Limp(t, 2), cracks: 0.45 }, hx, hy - bounce, S, land > 0 ? 0.08 : hitv ? -0.6 + fall * 0.6 : 1.4 * pre - 0.8, false, {});
      // the fist: the knuckles meet its upper right on the hit frame, then follow it down a way and pull back
      const C = [ax + 9 * S, ay - 6 * S], fa = PI * 0.75;
      let kx, ky;
      if (!hitv) { kx = lerp(lerp(C[0] + 110, C[0] + 170, wind), C[0], strike); ky = lerp(lerp(C[1] - 70, C[1] - 120, wind), C[1], strike); }
      else { const ft = eoc(Math.min(1, g / 0.2)), rec = eio(lin(0.25, 0.6, g)); kx = lerp(C[0] - 50 * ft, C[0] + 120, rec); ky = lerp(C[1] + 50 * ft, C[1] - 80, rec); }
      const M = [470, 10 + camY], s = 1.25, fs = 1.5, [wx, wy] = a4Wr(kx, ky, fa, s * fs), [lx, ly] = a4Loc(M, s, t, wx, wy);
      a4Sund(M[0], M[1], s, t, { third: 1, eyes: 1.3 + 0.4 * strike, heat: 0.85, crown: 0.75, rage: 0.3, lean: 8 * wind * (1 - strike) - 18 * strike * (1 - eio(lin(69.55, 69.9, T))), nod: 2 + 3 * strike, tilt: 0.06 * strike,
        arms: [{ x: lx, y: ly, pose: 'fist', ang: fa, front: true, fs }, a4Rest(100, 150, 7, t), a4Rest(-70, 196, 8, t), a4Rest(80, 196, 9, t)] });
      if (strike > 0.2 && !hitv) streaks(PI * 0.75, 22, t, 3400, 66, 120, 4752, [0, LB, W, H - 2 * LB]);
      const gr = t - 69.3, lr = t - 70.0;
      if (hitv) { megaHit(C[0], C[1], gr, 1.8, PI * 0.75, [22, 37, 35], 4758); z5Hit(C[0], C[1], gr, 1.5, PI * 0.75, 37, 4753); if (fall < 1) streaks(Math.atan2(gy - ay, gx - ax), 20, t, 3000, 122, 90, 4754, [0, LB, W, H - 2 * LB]); }
      if (land > 0) { megaHit(gx, 222 + camY * 0.2, lr, 1.6, -PI / 2, [22, 122, 99], 4755); a4Dust(gx, 222 + camY * 0.2, land, 10, 90, 4756); rocks(gx, 222 + camY * 0.2, land, 14, 160, 3, [97, 99, 122, 123], 4757, 400, -PI / 2, 1.8); }
      shk(hitv && g < 0.4 ? 7 * (1 - g / 0.4) : land > 0 && land < 0.4 ? 6 : 0.4);
      a4Cam(1.03, 0, 240, 135, kick(t, [[69.3, 2.2, PI * 0.75], [70.0, 1.6, PI / 2]]));
    });
  
    // 70.0–72.0 on the ledge, close and low: it tries to get up on its sword, and can't; a shadow; his hand comes down on it
    // and presses it into the rock: the palm flattens on its back, the fingers splay out over the stone, the stone cracks
    // round the fingertips; and he keeps pressing (it squirms under the hand)
    const A4PIN = [182, 196];                                     // where the hero lies pinned (72–77 reuse it)
    function a4PinScene(t, press, crack) {
      a4Deep(700, t, 0.45, 1400);
      a4Wall(1, 430, 720, t, 0.45, 1400, 4761, false);
      a4Ledge(214, 200, t, true);
      if (crack > 0) { groundCracks(A4PIN[0], 214, 90 * crack, 9, 4762, 104, 99); groundCracks(A4PIN[0] + 4, 215, 60 * crack, 6, 4763, 102, 98); }
    }
    // the pressing hand: palm on its back, angled down to the right so the fingertips reach the stone beyond it
    const A4PA = 0.4, A4PS = 3.0;
    function a4PinHand(t, hy, down, press, o) {
      o = o || {};
      // the heel of the palm on the stone behind it, the splayed fingers across its back (it shows between them)
      const px = A4PIN[0] - 44, py = hy - 6 * 3.2, pal = 5.5 * A4PS, wx = px - Math.cos(A4PA) * pal + (o.dx || 0), wy = lerp(-150, py - Math.sin(A4PA) * pal, down) + (o.dy || 0);
      const flex = 0.04 * z5N(t * 2.2, 5);
      const pose = a4PL({ curl: 0.38, thumb: 0.3, spread: 0.45 }, { curls: [0.08 + flex, 0.1 - flex, 0.12 + flex, 0.16], thumb: 0.1, spread: 1 }, press);
      return a4Arm(wx, wy, A4PS, A4PA + (o.da || 0), pose, 0.9, t, { bend: -0.6, side: -1 });
    }
    shot(70.0, 72.0, (lt, t) => {
      const g = t - 71.4, hitv = g > 0, down = eic(lin(71.2, 71.4, t)), shade = sstep(71.0, 71.38, t), press = eoc(lin(71.38, 71.52, t));
      a4PinScene(t, 0, hitv ? Math.min(1, g * 5) : 0);
      const S = 3.2, base = 214 - 14 * S;
      // the attempts: up on the sword, trembling, the arm gives; again, less
      const up1 = eio(lin(70.3, 70.85, t)) * (1 - eic(lin(70.88, 70.98, t))), up2 = eio(lin(71.02, 71.3, t)) * 0.35 * (1 - (hitv ? 1 : 0));
      const up = Math.max(up1, up2), tr = a4Tw(t, 8) * (0.4 + up * 1.6);
      const squirm = hitv ? sstep(0.35, 0.6, g) : 0;
      const sq = hitv ? (g < 0.05 ? 0.75 : 0.62 + 0.06 * sstep(0, 0.5, g) + 0.04 * Math.sin(t * 7) * squirm) : 0.38 * (1 - up);
      const hx = A4PIN[0] + tr * 0.6 + squirm * Math.sin(t * 5) * 1.5, hy = base + 12 * (1 - up) + (hitv ? 5 + 3 * sstep(0, 0.4, g) : 0) + tr * 0.3;
      const lookUp = !hitv && t > 71.12;
      const a = actor(HERO3({ eyes: hitv ? (g < 0.3 ? 'closed' : 'wide') : lookUp ? 'wide' : up > 0.2 ? 'narrow' : 'closed', mouth: hitv ? 2 : up > 0.3 ? 1 : 0, sword: hitv ? 0.15 + 0.1 * squirm * Math.sin(t * 6) : lerp(0.25, 1.45, up), sq, reach: up > 0.2 ? 2 : 0, legs: hitv ? [3, 3 - squirm * Math.max(0, Math.sin(t * 9)), 3, 3] : [3 - up * 2.2, 3 - up * 2, 3 - up * 2, 3 - up * 2.2], cracks: hitv ? 0.6 : 0.5 }), hx, hy, S, hitv ? 0.02 : -0.06 * up + 0.04, false, { bob: 0 });
      if (up1 > 0.4 && !hitv) for (let k = 0; k < 4; k++) { const x = a.tip[0] + (ih(k, fl(t * 12), 4764) - 0.5) * 8, y = 214 - ih(k, fl(t * 12) + 1, 4764) * 4; P(x, y, 123); }
      // the light goes: his shadow, grit falling out of it
      if (shade > 0) { for (let y = LB; y < H - LB; y++) { const k = shade * clamp(1.1 - (y - LB) / 200, 0, 1) * 0.7; if (k > 0.02) for (let x = 0; x < W; x++) tintI(y * W + x, x, y, T_DARK, k); } for (let k = 0; k < 30; k++) { const q = frac(ih(k, 1, 4765) + t * 1.5), x = 60 + ih(k, 2, 4765) * 300, y = LB + q * 190; if (q < shade) P(x, y, 122); } }
      // the hand: down, relaxed, then flattening on the hit frame (spread, straightened), a pump of weight, a slow grind
      const pump = hitv ? 4 * sstep(0, 0.5, g) + z5Knock(g, 5, 14, 5) + z5Sh(t, 3) * 1.0 + squirm * Math.sin(t * 5) * 1.2 : 0;
      if (down > 0) {
        const r = a4PinHand(t, hy, down, press, { dy: pump, da: hitv ? Math.sin(g * 4) * 0.02 : -0.15 * (1 - down) });
        // the stone cracks round the fingertips
        if (hitv) for (let k = 0; k < 4; k++) { const fx = r.tip[0] + (r[0] - r.tip[0]) * k / 3 + 6, fy = 214; groundCracks(fx, fy, 34 * Math.min(1, g * 6), 4, 4769 + k, 103, 99); }
      }
      if (down > 0.2 && !hitv) streaks(PI / 2, 26, t, 3600, 66, 120, 4766, [A4PIN[0] - 160, LB, 240, H - 2 * LB]);
      if (hitv) { megaHit(hx, 214, g, 2.4, -PI / 2, [22, 106, 103], 4767); a4Dust(hx, 214, g, 12, 110, 4768); rocks(hx + 40, 214, g, 16, 200, 3, [97, 99, 122, 123], 4769, 400, -PI / 2, 2.4); }
      shk(hitv ? (g < 0.5 ? 8 * (1 - g / 0.5) : 0.8) : 0.2);
      a4Cam(1.06 + 0.04 * lt / 2, 0, 230, 150, kick(t, [[71.4, 2.6, PI / 2]]));
    });

    /* ============================================================== 6 · the orbs (72.0–77.0)
       Pinned under one hand, it watches the other take the four orbs out of its halo one at a time and crush them: water
       (73.0) spills through his fingers like rain on its face; leaf (74.0) bursts into leaves that wither to ash as they fall;
       lightning (75.0) lashes once between his knuckles and is gone; starlight (76.0), the last, it reaches for — "NO—!" —
       and he crushes it in front of its eyes, and the stars go out one by one. The world loses its colour with each. */
    const A4OT = [73.0, 74.0, 75.0, 76.0], ELC = [[45, 46, 47, 119], [48, 49, 50, 26], [51, 52, 53, 22], [54, 55, 56, 57]];
    const a4OrbPos = (k, t, cx, cy) => { const a = t * 1.1 + k * TAU / 4; return [cx + 20 + Math.cos(a) * 52, cy - 34 + Math.sin(a) * 16, Math.sin(a)]; };
    shot(72.0, 77.0, (lt, t) => {
      let K = 0; while (K < 3 && t > A4OT[K] + 0.15) K++;
      const T = A4OT[K], reach = eio(lin(T - 0.85, T - 0.55, t)), lift = eio(lin(T - 0.55, T - 0.12, t)), sq = eic(lin(T - 0.12, T, t)), g = t - T;
      const drained = A4OT.filter((x) => t >= x).length;
      a4PinScene(t, 1, 1);
      const S = 3.2, base = 214 - 14 * S, hx = A4PIN[0] + a4Tw(t, 9) * 0.5, hy = base + 8 + z5Knocks(t, A4OT, 3, 16, 6);
      const strain = K === 3 ? eio(lin(75.6, 76.15, t)) * (1 - sstep(76.3, 76.9, t) * 0.7) : 0;
      // the halo: the orbs not yet taken still orbit it, dim
      const live = [0, 1, 2, 3].map((k) => (k > K || (k === K && t < T - 0.6) ? 1 : 0));
      for (let k = 0; k < 4; k++) { if (!live[k]) continue; const [x, y, z] = a4OrbPos(k, t, hx, hy); if (z < 0) a4Orb(x, y, k, 6.5, 0.9); }
      const a = actor(HERO3({ eyes: g >= 0 && g < 0.3 ? 'closed' : 'wide', mouth: strain > 0.2 || (g >= 0 && g < 0.4) ? 2 : 1, sword: 0.15 - strain * 0.5, sq: 0.66 - strain * 0.12, reach: 1 + strain * 3, legs: [3, 3, 3, 3], cracks: 0.6 + drained * 0.07 }), hx + strain * 6, hy - strain * 3, S, -0.04 - strain * 0.1, false, { bob: 0 });
      for (let k = 0; k < 4; k++) { if (!live[k]) continue; const [x, y, z] = a4OrbPos(k, t, hx, hy); if (z >= 0) a4Orb(x, y, k, 6.5, 0.9); }
      // the pinning hand on its back: it never lets up — it grinds, and bears down when it strains
      a4PinHand(t, hy, 1, 1, { dy: z5Sh(t, 3) * 0.9 + 3 * strain, da: Math.sin(t * 1.3) * 0.02 });
      // the taking hand, from the upper right: down to the orb on its orbit, fingers open; they close round it (four
      // frames); up in front of its eyes, held there pinched; the fingers crush shut on it; then they open on what is left
      const [ox, oy] = a4OrbPos(K, Math.min(t, T - 0.6), hx, hy), FS = 2.2, GR = 9.5 * FS;
      const grab = eoc(lin(T - 0.6, T - 0.48, t)), after = K === 3 ? 0 : eio(lin(T + 0.32, T + 0.6, t));
      const fa = PI * 0.66 - lift * 0.12 - sq * 0.06, ux = Math.cos(fa), uy = Math.sin(fa);
      const rest = [430, 30 + Math.sin(t) * 4], top = [hx + 74 + z5N(t, 4) * 3, hy - 62 + z5N(t * 1.2, 6) * 2];
      let gx = lerp(rest[0], ox, reach), gy = lerp(rest[1], oy, reach);
      gx = lerp(gx, top[0], lift); gy = lerp(gy, top[1], lift);
      if (K === 3 && g > 0.3) { const back = eio(lin(T + 0.3, T + 1.0, t)); gx += back * 30; gy -= back * 20; }
      gx += z5Knock(g, 4, 18, 5); gy += z5Knock(g, 5, 18, 5) + (sq > 0 ? z5Sh(t, 4) * 1.5 * sq : 0);
      const held = grab > 0 && g < 0.02;
      const orbP = held ? [gx, gy] : [ox, oy];
      // the thread of its light from its chest to the orb, stretching till it snaps
      if (held && lift < 0.6) lineF(hx + 10, hy - 6, orbP[0], orbP[1], (x, y, u) => { if (bay(x, y) < 0.9 - Math.abs(u - 0.5) - lift) P(x, y + Math.sin(u * 12 + t * 30) * 2 * lift, ELC[K][2]); });
      const flex = 0.05 * z5N(t * 2, 9) * lift;
      let pose = a4PL({ curl: 0.3, thumb: 0.2, spread: 0.9 }, { curl: 0.56 + flex, thumb: 0.62, spread: 0.3 }, grab);
      if (sq > 0 || g >= 0) pose = a4PL(pose, 'fist', g >= 0 ? 1 : sq);
      if (after > 0) pose = a4PL(pose, { curl: 0.3, thumb: 0.2, spread: 0.7 }, after);
      const r_ = a4Arm(gx - ux * GR, gy - uy * GR, FS, fa, pose, 0.9, t, { bend: 0.6, side: 1, hold: held ? () => {
        // inside his hand: it burns brighter, as if it knew, and is crushed out of shape as the fingers shut
        const r = (7 + lift * 2.5) * (1 - 0.55 * sq), pv = 1 + 0.25 * Math.sin(t * 40) * lift;
        glow(gx, gy, 34 * pv, EL_T[K], 0.5 + 0.3 * lift);
        a4Orb(gx + z5Sh(t, 7) * sq, gy, K, r, 1);
      } : undefined });
      // the light forced out between the fingers as they close on it
      if (held && sq > 0) { glow(gx, gy, 40 * sq + 10, EL_T[K], 0.35 * sq); for (let k = 0; k < 5; k++) { const a2 = fa + PI + (k - 2) * 0.45, L = 6 + 20 * sq * ih(k, fl(t * 30), 4779); lineP(gx, gy, gx + Math.cos(a2) * L, gy + Math.sin(a2) * L, ELC[K][2]); } }
      // the crushes, each its own
      if (g >= 0 && g < 1.6) {
        const [c0, c1, c2] = ELC[K], cx = gx, cy = gy, fade = 1 - clamp(g / 0.9, 0, 1);
        if (g < 0.5) glow(cx, cy, 110 * (1 - g * 2), EL_T[K], 0.7);
        // water: it runs out between his fingers and falls on its face like rain
        if (K === 0) for (let k = 0; k < 44; k++) { const q = g * (0.7 + ih(k, 1, 4771) * 0.6), x = cx + (ih(k, 2, 4771) - 0.5) * 34 + (ih(k, 4, 4771) - 0.5) * 30 * q, y = cy + 8 + q * 30 + q * q * 220; if (y < hy + 12 && bay(fl(x), fl(y)) < 1.3 - g * 0.8) { P(x, y, k % 3 ? c1 : 22); P(x, y - 1, c0); P(x, y - 2, c0); } }
        // leaf: a burst of leaves that wither and turn to ash as they fall
        if (K === 1) for (let k = 0; k < 28; k++) { const q = g, a2 = -PI * 1.2 * ih(k, 1, 4772) + 0.2, sp = 70 + 70 * ih(k, 5, 4772), x = cx + Math.cos(a2) * sp * eoc(Math.min(1, q * 2)) + Math.sin(q * 5 + k) * 8, y = cy + Math.sin(a2) * sp * 0.6 * eoc(Math.min(1, q * 2)) + q * q * 80, rot = q * 6 + k, wilt = clamp(q / 1.1, 0, 1); if (y > hy + 14) continue; const col = wilt < 0.35 ? (k % 2 ? c1 : c2) : wilt < 0.7 ? 29 : 121; for (let j = -2; j <= 2; j++) { P(x + Math.cos(rot) * j, y + Math.sin(rot) * j * 0.6, j === 0 && wilt < 0.35 ? c2 : col); P(x + Math.cos(rot) * j - Math.sin(rot), y + Math.sin(rot) * j * 0.6 + 1, col); } }
        // lightning: it lashes out between his knuckles once, a last flicker, and then nothing
        if (K === 2) { if (g < 0.3) for (let k = 0; k < 6; k++) { const a2 = -PI * 0.9 + k * 0.5 + ih(k, fl(t * 30), 4773) * 0.3; bolt(cx, cy, cx + Math.cos(a2) * 120 * (1 - g * 2), cy + Math.sin(a2) * 90, fl(t * 30) + k, k % 2 ? 1 : 2, 53, 52); } if (g > 0.45 && g < 0.52) { bolt(cx, cy, cx - 30, cy + 26, 77, 1, 53, 51); } }
        // starlight: the stars scatter and go out, one by one
        if (K === 3) for (let k = 0; k < 26; k++) { const a2 = ih(k, 1, 4774) * TAU, v = 30 + ih(k, 2, 4774) * 110, x = cx + Math.cos(a2) * v * eoc(Math.min(1, g * 1.2)), y = cy + Math.sin(a2) * v * 0.7 * eoc(Math.min(1, g * 1.2)) - g * 10, out = 0.2 + ih(k, 3, 4774) * 0.85; if (g < out) sparkle(x, y, 1 + 2.5 * (1 - g / out), k % 3 ? c2 : 22, c1); }
        if (g < 0.3) z5Hit(cx, cy, g, 0.8, -PI / 2, c2, 4775 + K);
        if (g > 0.3) for (let k = 0; k < 8; k++) { const q = frac(ih(k, 1, 4776) + g * 1.2), x = cx + (ih(k, 2, 4776) - 0.5) * 10, y = cy + 14 + q * 60; if (bay(fl(x), fl(y)) < fade) P(x, y, 94); }
      }
      // each crush takes colour out of the world
      tintAll(T_ASH, A4OT.reduce((s_, x) => s_ + 0.16 * sstep(x, x + 0.6, t), 0));
      if (g >= 0 && g < 0.1) tintAll(EL_T[K], 0.18 * (1 - g / 0.1));
      // the camera: a different place for each crush
      const CAMS = [[1.0, 0, 240, 138], [1.22, -0.03, 262, 130], [1.12, 0.04, 230, 140], [1.3, 0, 250, 128]];
      const ci = t < 73.45 ? 0 : t < 74.45 ? 1 : t < 75.45 ? 2 : 3, C = CAMS[ci], push = 0.04 * eio(frac(t - 72.45));
      shk(g >= 0 && g < 0.3 ? 4 * (1 - g / 0.3) : 0.6);
      a4Cam(C[0] + push, C[1], C[2], C[3], kick(t, A4OT.map((x) => [x, 1.2, PI / 2])));
    });
    CAPS.push([76.2, 77.4, 's', 'HERO', 'NO—!']);
  
    /* ============================================================== 7 · the drop (77.0–80.0)
       He takes his hand off it, picks it up between two fingers, holds it out over the dark, and lets it go. */
    shot(77.0, 78.4, (lt, t) => {
      const off = eio(lin(77.0, 77.35, t)), come = eio(lin(77.08, 77.4, t)), pinch = eoc(lin(77.38, 77.5, t)), raise = eio(lin(77.52, 78.0, t)), open = eoc(lin(78.02, 78.12, t)), drop = t > 78.06 ? t - 78.06 : 0;
      const camY = 150 * raise;
      a4Deep(700 - camY, t, 0.45, 1400);
      a4Wall(1, 430, 720 - camY, t, 0.45, 1400, 4761, false);
      a4Ledge(214 + camY, 200, t, true);
      const S = 3.2, base = 214 - 14 * S + 8 + camY;
      // the pinning hand lifts off it (the fingers curling as they come away)
      if (off < 1) a4PinHand(t, base, 1, 1 - off, { dx: -off * 150, dy: -off * 190 });
      // the other hand: down to it, finger and thumb open; they close on the scruff of it (three frames); up, out over the
      // drop, held there; and they open
      const fa = PI * 0.56 + raise * 0.1, ux = Math.cos(fa), uy = Math.sin(fa), FS = 2.4;
      const P0 = [A4PIN[0] + 6, base - 8 * S + 2], P1 = [300, 104];                 // the pinch: on it, and out over the dark
      let px = lerp(420, P0[0], come), py = lerp(-60, P0[1], come);
      px = lerp(px, P1[0], raise) + z5Sh(t, 5) * 0.6 * raise; py = lerp(py, P1[1], raise) - z5Knock(t - 77.45, 4, 16, 6);
      const sway = Math.sin(t * 3.2) * 0.25 * raise + z5Knock(t - 78.0, 0.12, 9, 3);
      const fallY = drop * drop * 500 + drop * 40;
      const drawHero = (x, y, ang, held) => actor(HERO3({ eyes: 'narrow', mouth: held ? 1 : 0, sword: 1.5 - sway, sq: held ? lerp(0.6, -0.15, pinch) : 0.1, legs: z5Limp(t, 1.4), cracks: 0.88, reach: 2 }), x, y, S - drop * 0.8, ang, false, { bob: 0, still: held });
      const held = pinch > 0 && open < 0.4;
      // hanging from the pinch: its top caught between finger and thumb, the rest of it swinging under
      const hang = (q) => [q[0] - Math.sin(sway) * 8 * S, q[1] + Math.cos(sway) * 8 * S];
      if (!held) { const [hx0, hy0] = pinch > 0 ? hang([px, py]) : [A4PIN[0], base]; drawHero(hx0 + drop * 10, hy0 + fallY, pinch > 0 ? sway + drop * 2 : 0.02, false); }
      const pose = a4PL(a4PL({ curls: [0.15, 0.9, 0.95, 1], thumb: 0.15, spread: 0.2 }, 'pinch', pinch), { curls: [0.05, 0.6, 0.7, 0.8], thumb: 0.05, spread: 0.6 }, open);
      if (come > 0) a4Arm(px - ux * 15 * FS, py - uy * 15 * FS, FS, fa, pose, 0.9, t, { bend: 0.5, side: -1,
        hold: held ? () => { const [hx0, hy0] = hang([px, py]); drawHero(hx0, hy0, sway, true); } : undefined });
      a4Embers(t, 24, -40, 4781, [94, 93]);
      tintAll(T_ASH, 0.5);
      shk(0.5);
      a4Cam(1.05, 0, 240, 135);
    });
    // straight down the chasm: the walls run away to a line of dark; it falls into it, smaller and smaller, its light going
    function a4Down(t, depth, fadeK) {
      for (let y = LB; y < H - LB; y++) {
        const dy = y + 0.5 - 135, ad = Math.abs(dy), row = y * W;
        const z = 1600 / Math.max(2, ad), wz = z + depth, hot = clamp(1 - wz / 1400, 0, 1) * fadeK, near = clamp(1 - z / 300, 0, 1);
        for (let x = 0; x < W; x++) {
          if (ad < 2) { BUF[row + x] = 0; continue; }
          const v = seamAt(x / (50 * (1 - near * 0.5) + 10) + (dy > 0 ? 9 : 3), wz / 60), n = vn(x * 0.5, wz * 0.5, 9, 4791), dk = clamp(z / 500, 0, 1);
          let c = v < 0.02 + hot * 0.04 ? (hot > 0.5 ? 104 : hot > 0.2 ? 102 : hot > 0.05 ? 101 : 97) : n > 0.6 ? 99 : n > 0.3 ? 98 : 97;
          if (bay(x, y) < dk) c = dk > 0.8 ? 0 : 96;
          BUF[row + x] = c;
        }
      }
    }
    shot(78.4, 80.0, (lt, t) => {
      const u = lt / 1.6, depth = 200 + lt * 600;
      a4Down(t, depth, 1 - u * 0.8);
      tintAll(T_ASH, 0.5);
      const S = lerp(3.0, 0.35, eoc(u)), hx = 240 + Math.sin(lt * 1.7) * 22 * (1 - u), hy = 135 + Math.cos(lt * 1.3) * 14 * (1 - u);
      glow(hx, hy, 30 * S, T_WARM, 0.35 * (1 - u));
      actor(HERO3({ eyes: 'closed', sword: 1.2, legs: z5Limp(t, 1.6), cracks: 0.88 }), hx, hy, S, lt * 1.9, false, { still: true });
      // embers falling with it, overtaking it; grit streaming up past the camera
      for (let k = 0; k < 30; k++) { const q = frac(ih(k, 1, 4792) + lt * 0.9), r = 260 * (1 - q), a = ih(k, 2, 4792) * TAU, x = 240 + Math.cos(a) * r, y = 135 + Math.sin(a) * r * 0.55; if (bay(fl(x), fl(y)) < 1 - q * 0.6) { P(x, y, q < 0.5 ? 122 : 121); } }
      a4Cam(1.0, lt * 0.06, 240, 135);
    });

    /* ============================================================== 8 · all hope lost (80.0–88.0)
       The floor of the world. Far above, a thread of fire, and in it his eyes like two moons. "STAY DOWN." It tries to get up,
       and falls; again, and falls; and then, from the floor: "...NO." The cracks in it begin to burn. */
    function a4Floor(t, top, ox, k) {
      for (let x = 0; x < W; x++) {
        const wx = x / k + ox, y0 = top + (vn(wx, 0, 26, 4801) - 0.5) * 8 * k + (vn(wx, 0, 6, 4802) - 0.5) * 3 * k;
        for (let y = Math.max(LB, fl(y0)); y < H - LB; y++) { const d = (y - y0) / k, n = vn(wx, y / k, 4, 4803); BUF[y * W + x] = d < 1 ? 121 : n > 0.7 ? 98 : n > 0.4 ? 97 : 96; }
      }
      for (let k2 = 0; k2 < 24; k2++) { const x = ih(k2, 1, 4804) * W, y = top + 4 + ih(k2, 2, 4804) * 30 * k, r = (1 + ih(k2, 3, 4804) * 3) * k; discF(x, y, r, 98); P(x - r * 0.3, y - r * 0.4, 121); }
    }
    // his eyes, far above: two moons of fire in a slit of light, and the third between them
    function a4Moons(cx, cy, r, t, flare) {
      for (const sd of [-1, 1]) { const x = cx + sd * r * 2.6, y = cy + Math.abs(sd) * 0; glow(x, y, r * 5 * (1 + flare), T_EMBER, 0.45 + flare * 0.3); discF(x, y, r * 1.15, 103); discF(x, y, r, 106); discF(x - r * 0.2, y - r * 0.2, r * 0.6, 107); }
      glow(cx, cy - r * 1.6, r * 4, T_MAG, 0.4 + flare * 0.3); discF(cx, cy - r * 1.6, r * 0.75, 73); discF(cx, cy - r * 1.6, r * 0.45, 76); P(cx, cy - r * 1.6, 75);
    }
    function a4Pit(t, slit, eyes, flare) {
      gradient(LB, H - LB, [96, 96, 97, 96, 96]);
      // the walls rise on both sides to a slit of fire, far above
      // (the walls: the chasm's rock, barely lit — the slit's fire catching the ledges near the top, dying with depth)
      for (let y = LB; y < H - LB; y++) {
        const q = (y - LB) / (H - 2 * LB), half = lerp(slit, 260, Math.pow(q, 1.6)), row = y * W, cx = 240 + Math.sin(q * 4) * 6;
        const hot = 0.6 * (1 - q) * (1 - q) * (1 - q), RL = a4TexRow(4806, fl(y * 1.6 + 2000)), RR = a4TexRow(4807, fl(y * 1.6 + 2000));
        for (let x = 0; x < W; x++) {
          const dx = x - cx, d = Math.abs(dx) - half;
          if (d > 0) { const v = dx < 0 ? RL[x] : RR[W - 1 - x]; BUF[row + x] = d < 1.5 ? (q < 0.4 ? 103 : 99) : d < 4 && q < 0.5 ? 101 : a4Lit(v, x, y, hot * (d < 40 ? 1 : 0.6), 0.08, -3 + (d < 12 ? 1 : 0) - fl(q * 1.5)); }
          else if (q < 0.08) BUF[row + x] = q < 0.03 ? 105 : 103;
        }
      }
      glow(240, LB, 120, T_EMBER, 0.35);
      if (eyes > 0) { a4Moons(240, LB + 16, 5.2 * eyes, t, flare); for (let k = 0; k < 3; k++) z5Ray(240 + (k - 1) * 14, LB + 10, PI / 2 + (k - 1) * 0.12, 220, 16, 97, 97, 0.18); }
      // ash drifting down through the dark
      for (let k = 0; k < 60; k++) { const y = LB + frac(ih(k, 1, 4805) + t * 0.05 * (0.5 + ih(k, 3, 4805))) * 218, x = ih(k, 2, 4805) * W + Math.sin(t * 0.7 + k) * 8; P(x, y, k % 5 ? 93 : 121); }
    }
    const A4BEATS = [81.0, 84.0, 86.5, 87.0, 87.4, 87.7, 87.88];
    const a4Beat = (t) => { let b = 0; for (const h of A4BEATS) { const g = t - h; if (g > 0) b = Math.max(b, Math.exp(-g * 5) * (h > 86.9 ? 1 : 0.5)); } return b; };
    // 80.0–83.6 wide, from the floor: tiny, far below his eyes
    shot(80.0, 83.6, (lt, t) => {
      const fl0 = eio(lin(80.0, 80.25, t)), speak = t > 81.0 && t < 82.2 ? 0.4 * Math.sin((t - 81) * PI / 1.2) : 0;
      a4Pit(t, 10, 1, speak);
      a4Floor(t, 214, 30, 1);
      // landing (it has just hit the floor), then lying still; 82.0–83.5 it tries: up onto its arm, and down
      const tryU = eio(lin(82.1, 82.9, t)) * (1 - eic(lin(83.0, 83.25, t))), tr = a4Tw(t, 12) * tryU * 1.2;
      const S = 1.6, hx = 232 + tr * 0.5, hy = 214 - 14 * S + 10 * (1 - tryU) - (1 - fl0) * 30;
      glow(hx, hy, 22, T_WARM, 0.18 + a4Beat(t) * 0.2);
      actor(HERO3({ eyes: tryU > 0.3 ? 'narrow' : 'closed', sword: lerp(0.2, 1.4, tryU), sq: 0.45 * (1 - tryU), legs: [3 - tryU * 2, 3 - tryU * 2, 3, 3], cracks: 0.88, mouth: tryU > 0.5 ? 1 : 0 }), hx, hy, S, 0.05 - tryU * 0.08, false, { bob: 0 });
      if (lt < 0.4) a4Dust(hx, 214, lt, 8, 40, 4806);
      if (lt < 0.1) shk(3 * (1 - lt / 0.1));
      a4Cam(1.0 + lt * 0.02, 0, 240, 135);
    });
    CAPS.push([81.0, 83.0, 's', 'SUNDERER', 'STAY DOWN.']);
    // 83.6–86.2 close on the floor: up on the cracked sword, trembling, and down; again
    shot(83.6, 86.2, (lt, t) => {
      a4Pit(t, 30, 0, 0);
      tintAll(T_DARK, 0.3);
      a4Floor(t, 218, 300, 2.2);
      const t1 = eio(lin(83.7, 84.6, t)) * (1 - eic(lin(84.75, 84.92, t))), t2 = eio(lin(85.15, 86.1, t)) * 0.8, up = Math.max(t1, t2);
      const tr = a4Tw(t, 13) * (0.3 + up * 2.2), S = 4.2, hx = 214 + tr * 0.7, hy = 218 - 14 * S + 16 * (1 - up) + tr * 0.4;
      glow(hx, hy, 60, T_WARM, 0.15 + a4Beat(t) * 0.25);
      const a = actor(HERO3({ eyes: up > 0.5 ? 'narrow' : 'closed', mouth: up > 0.4 ? 1 : 0, sword: lerp(0.3, 1.38, up), sq: 0.42 * (1 - up), reach: up > 0.3 ? 2.5 : 0, legs: [3 - up * 2.4, 3 - up * 2, 3 - up * 2, 3 - up * 2.4].map((v, k) => v + (up > 0.2 ? Math.max(0, Math.sin(t * 40 + k)) * up : 0)), cracks: 0.88 }), hx, hy, S, 0.04 - up * 0.06, false, { bob: 0 });
      a4SwordCracks(a.hand, a.tip, 1, 4811);
      // when the arm gives
      const g = t - 84.92; if (g > 0 && g < 0.5) { a4Dust(hx, 218, g, 8, 60, 4812); shk(3 * (1 - g / 0.5)); }
      a4Cam(1.0 + lt * 0.02, 0, 230, 150);
    });
    // 86.2–88.0 its face, very close, from the floor: it lifts its head to the eyes above. "...NO." The cracks begin to burn,
    // a heartbeat at a time, faster
    shot(86.2, 88.0, (lt, t) => {
      const beat = a4Beat(t), rise = eio(lin(86.4, 87.9, t)), burn = sstep(86.8, 88.0, t);
      a4Pit(t, 18, 0.9, 0);
      a4Floor(t, 232, 600, 3);
      const S = 6.0, tr = a4Tw(t, 14) * (0.6 + rise * 1.5), hx = 236 + tr, hy = 232 - 14 * S + 22 * (1 - rise) - beat * 2;
      glow(hx, hy, 90 + beat * 60, T_EMBER, 0.15 + beat * 0.35 + burn * 0.2);
      actor(HERO3({ eyes: t < 86.45 ? 'closed' : t < 87.3 ? 'narrow' : 'angry', mouth: t > 86.5 && t < 87.0 ? 1 : t > 87.5 ? 2 : 0, sword: lerp(0.4, 1.3, rise), sq: 0.3 * (1 - rise), reach: 2, legs: [3 - rise * 2.5, 3 - rise * 2.5, 3 - rise * 2.5, 3 - rise * 2.5], cracks: 0.9 }), hx, hy, S, -0.05 * rise, false, { bob: 0 });
      // the cracks burn on each beat: light from inside it
      if (beat > 0.05 || burn > 0) { for (let y = Math.max(LB, SMB[1]); y <= Math.min(H - LB - 1, SMB[3]); y++) for (let x = Math.max(0, SMB[0]); x <= Math.min(W - 1, SMB[2]); x++) { const i = y * W + x; if (SMASK[i] && (BUF[i] === 107 || BUF[i] === 103)) BUF[i] = beat + burn > 0.6 ? 22 : 105; } }
      for (let k = 0; k < 12 * burn; k++) { const q = frac(ih(k, 1, 4821) + t * 1.4), x = hx + (ih(k, 2, 4821) - 0.5) * 26 * S, y = hy - q * 60; if (bay(fl(x), fl(y)) < 1 - q) P(x, y, q < 0.4 ? 106 : 104); }
      shk(burn * 1.5);
      a4Cam(1.0 + lt * 0.03, 0, 236, 140);
    });
    CAPS.push([86.5, 88.0, 's', 'HERO', '...NO.']);
  
    /* ============================================================== 9 · LAST LIGHT (88.0–90.6)
       It burns its own life: its body chars black, fire pours out of every crack, and the cracked sword is re-forged in that
       fire and grows — out of the chasm, past him, through the clouds, miles long. The camera rides up the blade. */
    function a4Last(x, y, S, t, o) {
      const pw = o.power === undefined ? 1 : o.power;
      glow(x, y, 70 * S * pw, T_FIRE, 0.45 * pw);
      const a = actor(HERO3({ form: 'lastlight', eyes: o.eyes || 'glow', mouth: o.mouth, sword: o.sw, sq: o.sq, legs: o.legs, reach: o.reach }), x, y, S, o.ang || 0, false, { bob: o.bob, still: o.still });
      aura(t, LASTF, 4.5 * S * pw, { sparks: fl(20 * pw), rise: 1.4 });
      // fire jetting out of the seams in it
      for (let k = 0; k < 14 * pw; k++) { const a2 = ih(k, 1, 4831) * TAU, q = frac(ih(k, 2, 4831) + t * 2.2), r0 = 9 * S, r1 = r0 + (12 + 20 * ih(k, 3, 4831)) * S * q; const x0 = x + Math.cos(a2) * r0, y0 = y + Math.sin(a2) * r0 * 0.7; lineF(x0, y0, x + Math.cos(a2) * r1, y + Math.sin(a2) * r1 * 0.7 - q * 8 * S, (X, Y, u) => { if (bay(X, Y) < 1 - u * 0.8 - q * 0.3) P(X, Y, u < 0.3 ? 22 : u < 0.6 ? 106 : 104); }); }
      return a;
    }
    shot(88.0, 88.9, (lt, t) => {
      const g = t - 88.0, rise = eoc(Math.min(1, g / 0.3)), grow = eic(lin(88.25, 88.9, t)), tiltUp = eic(lin(88.55, 88.9, t));
      a4Pit(t, 18, 0.9, 0.6);
      a4Floor(t, 236 + tiltUp * 60, 600, 3);
      groundCracks(226, 236 + tiltUp * 60, 200 * rise, 12, 4832, 106, 104);
      const S = 3.6, hx = 226 + a4Tw(t, 15) * 1.2, hy = 236 - 14 * S + tiltUp * 60;
      const a = a4Last(hx, hy, S, t, { eyes: 'glow', mouth: 2, sw: -1.45, sq: -0.15 * (1 - rise) });
      // the sword re-forged: fire runs up the cracked blade and it grows, and keeps growing, up out of the top of the frame
      const L = 29 * S * (1 + grow * 14);
      bigBlade(a.hand[0], a.hand[1], -PI / 2 + 0.05, L, 6, t, { form: 'lastlight', grow: grow < 1 ? 0.999 : 1, surge: true, flare: 0.9 });
      if (g < 0.4) { shockRing(hx, 236, 10 + g * 900, 4 + g * 120, 4, [22, 106, 104], 1 - g / 0.4); glow(hx, hy, 260 * (1 - g * 2), T_WH, 0.6); }
      rocks(hx, 236, g, 26, 260, 4, [97, 99, 104, 106], 4833, 300, -PI / 2, 2.4);
      if (g < 0.02) impactFrame(hx, hy, 0);
      shk(g < 0.5 ? 7 * (1 - g / 0.5) : 2);
      a4Cam(1.0, 0, 236, 140, kick(t, [[88.0, 3, PI / 2]]));
    });
    CAPS.push([88.0, 89.3, 'x', '', 'LAST LIGHT!', 54]);
    /* the column of the world, side on, for the ride up the blade: world x 240 is the blade; altitude a (0 the chasm floor,
       600 the sea, 1500–1620 the cloud cover, the dawn above); the camera sits at altitude cA, k screen px per unit */
    const A4SEA = 600, A4CL0 = 1500, A4CL1 = 1640;
    function a4Column(t, cA, k, tipA, hole, yFrom) {
      const SKYD = [16, 15, 8, 7, 6, 5, 4];
      for (let y = Math.max(LB, yFrom || 0); y < H - LB; y++) {
        const a = cA + (135 - y) / k, row = y * W;
        for (let x = 0; x < W; x++) {
          const wx = (x - 240) / k, ax = Math.abs(wx);
          let c;
          if (a < 0) c = vn(wx, a, 6, 4841) > 0.6 ? 98 : 97;
          else if (a < A4SEA) {
            const q = a / A4SEA;
            if (ax < 70 + q * 20) c = q > 0.85 ? (bay(x, y) < (q - 0.85) * 6 ? 103 : 102) : q > 0.5 ? (bay(x, y) < 0.3 ? 101 : 97) : 96;
            else { const v = k > 0.3 ? seamAt(wx / 50 + 20, a / 60) : 1; c = v < 0.02 + q * 0.03 ? (q > 0.7 ? 104 : q > 0.4 ? 102 : 101) : ax < 76 + q * 20 ? (q > 0.6 ? 103 : 99) : vn(wx, a, 12, 4842) > 0.55 ? 98 : 97; }
          } else if (a < A4SEA + 16 && ax > 90) { const sw = Math.sin(wx * 0.05 + t * 2 + a); c = a < A4SEA + 3 ? 118 : sw > 0.6 ? 117 : OCEAN[fl((a - A4SEA) / 6)]; }
          else if (a < A4CL0) { const q = (a - A4SEA) / (A4CL0 - A4SEA), R = [102, 101, 98, 97, 97], f = q * 4, i = fl(f); c = bay(x, y) < f - i ? R[Math.min(4, i + 1)] : R[i]; }
          else if (a < A4CL1) {
            const bot = A4CL0 + fbm(wx, 0, 90, 3, 4843) * 50, top = A4CL1 - 40 + fbm(wx + 7, 0, 60, 3, 4844) * 70, hr = hole * (1 + 0.3 * vn(wx, a, 30, 4845));
            if (ax < hr || a < bot || a > top) c = a > (A4CL0 + A4CL1) / 2 ? SKYD[0] : 97;
            else { const db = a - bot, dt = top - a, n = vn(wx * 1.2, a * 2, 14, 4848); c = db < 3 ? 102 : db < 10 ? (n > 0.5 ? 121 : 120) : dt < 3 ? 16 : dt < 10 ? (n > 0.4 ? 15 : 19) : dt < 26 ? (n > 0.55 ? 19 : 18) : n > 0.6 ? 18 : 121; if (ax < hr + 5 / k) c = 106; }
          } else { const q = clamp((a - A4CL1) / 900, 0, 0.999); c = SKYD[fl(q * 7)]; if (bay(x, y) < frac(q * 7)) c = SKYD[Math.min(6, fl(q * 7) + 1)]; }
          BUF[row + x] = c;
        }
      }
      // spires on the sea, and the blade's light on the cloud
      for (let k2 = 0; k2 < 9; k2++) { const wx = (ih(k2, 1, 4846) - 0.5) * 2400, h = 80 + ih(k2, 2, 4846) * 220, w = 20 + ih(k2, 3, 4846) * 30; if (Math.abs(wx) < 140) continue; const x0 = 240 + wx * k, yb = 135 - (A4SEA - cA) * k, yt = yb - h * k; if (yb < LB || yt > H - LB) continue; for (let y = Math.max(LB, fl(yt)); y < Math.min(H - LB, yb); y++) { const v = (yb - y) / (h * k), hw = w * k * (0.3 + 0.7 * (1 - v)); for (let x = fl(x0 - hw); x <= x0 + hw; x++) P(x, y, v > 0.9 ? 103 : 98); } }
      const ys = 135 - ((A4CL0 + A4CL1) / 2 - cA) * k; if (ys > LB - 60 && ys < H + 60 && tipA > A4CL0) glow(240, ys, 160 * Math.max(0.4, k), T_EMBER, 0.5);
    }
    shot(88.9, 90.6, (lt, t) => {
      const u = eio(lin(88.9, 90.0, t)), zo = eio(lin(89.7, 90.55, t));
      const tipA = 300 + 2600 * eoc(lin(88.9, 89.7, t)), cA = lerp(lerp(70, 1560, u), 1300, zo), k = lerp(lerp(1.0, 0.7, u), 0.085, zo);
      const hole = tipA > A4CL0 ? Math.min(150, 30 + (tipA - A4CL0) * 0.1) : 0;
      a4Column(t, cA, k, tipA, hole);
      // embers and ash falling past as we rise
      a4Embers(t, 50, -700 * (1 - u) - 40, 4849, [104, 102]);
      // him: standing in the sea beside it, his face passing as we rise; he turns to look at it
      const so = 1.5 * k, mx = 240 + 300 * k, my = 135 - (1080 - cA) * k;
      if (my > -200 && my < H + 200) { a4Sund(mx, my, so, t, { third: 1, eyes: 1.4, heat: 0.85, crown: 0.75, tilt: 0.15 * u, arms: [a4Rest(-110, 140, 20, t), a4Rest(110, 150, 21, t), a4Rest(-80, 200, 22, t), a4Rest(80, 200, 23, t)] }); const sy = fl(135 - (A4SEA + 16 - cA) * k); if (sy < H - LB) a4Column(t, cA, k, tipA, hole, sy); }
      // the blade, from the hero far below to its tip
      const hy = 135 - (24 - cA) * k, ty = 135 - (tipA - cA) * k;
      bigBlade(240, hy, -PI / 2, hy - ty, Math.max(1.6, 7 * k), t, { form: 'lastlight', grow: tipA < 2890 ? 0.999 : 1, surge: true, flare: 0.9 });
      glow(240, Math.max(LB, ty), 40, T_WH, 0.6);
      if (hy < H - LB + 40) { const S = 5 * k; a4Last(240 - 22 * k, hy + 6 * k, Math.max(0.6, S), t, { mouth: 2, sw: -1.5, still: true }); }
      else glow(240, H - LB, 80, T_FIRE, 0.4);
      // streaks of the ride
      if (u < 0.95) streaks(PI / 2, 26, t, 2600 * (1 - u), 104, 60, 4847, [0, LB, W, H - 2 * LB]);
      shk(2 - zo);
      a4Cam(1.0, 0, 240, 135);
    });
  
    /* ============================================================== 10 · the giants (90.6–100.8)
       The blade, rooted in the chasm where the hero stands, against him: four arms crossed, a backhand, a fist, a hammer that
       drives it into the sea, a block; the lower left arm cut off at the elbow, the lower right; a cut across his mask; and
       then he catches it in his two hands, holds it, and snaps it. One world, seen through many cameras: V = { k, ox, oy }
       maps world (the wide view at k 1) to the screen. */
    const GM = [340, 78], GS = 0.8, GSEA = 200, GWL = 246;            // his mask, scale; the horizon; his waterline
    const gl = (lx, ly) => [GM[0] + lx * GS, GM[1] + ly * GS], lg = (x, y) => [(x - GM[0]) / GS, (y - GM[1]) / GS];
    // the exchange: blade pivot (the hero's hand, deep in the chasm) and angle and length, keyed in time
    const GK = [
      // t, pivot x, pivot y, angle, length, ease
      [90.3, 160, 340, -1.57, 1400], [90.6, 160, 340, -0.86, 1400, 'i'], [91.0, 160, 340, -1.05, 1400, 'o'],
      [91.2, 150, 344, -1.32, 1400], [91.4, 150, 344, -1.15, 1400, 'i'], [91.7, 150, 344, -1.45, 1400, 'o'],
      [91.85, 140, 336, -1.3, 1400], [92.0, 140, 336, -1.0, 1400, 'i'], [92.3, 140, 336, -1.3, 1400, 'o'],
      [92.45, 150, 340, -1.35, 1400], [92.6, 150, 340, -1.08, 1400, 'i'], [92.8, 150, 340, -0.45, 1400, 'o'], [93.0, 150, 340, -0.75, 1400],
      [93.2, 165, 330, -0.74, 1400, 'i'], [93.5, 165, 330, -1.1, 1400, 'o'],
      [94.0, 150, 340, -1.45, 1400, 'io'], [94.2, 150, 340, -0.98, 1400, 'i'], [94.4, 150, 340, -0.45, 1400, 'o'], [94.9, 150, 340, -0.8, 1400],
      [95.2, 150, 340, -1.3, 1400], [95.4, 150, 340, -0.76, 1400, 'i'], [95.6, 150, 340, -0.35, 1400, 'o'], [96.2, 150, 340, -0.75, 1400],
      [96.45, 150, 340, -1.25, 1400], [96.6, 150, 340, -0.94, 1400, 'i'], [96.8, 150, 340, -0.62, 1400, 'o'],
      [97.15, 150, 340, -1.3, 1400], [97.4, 150, 340, -0.86, 1400, 'i'], [100.0, 150, 340, -0.86, 1400],
    ];
    function a4Blade(t) {
      let i = 0; while (i < GK.length - 1 && GK[i + 1][0] <= t) i++;
      const A = GK[i], B = GK[i + 1];
      let r;
      if (!B || t <= A[0]) r = { x: A[1], y: A[2], a: A[3], L: A[4] };
      else { const u = EASE[B[5] || 'io'](clamp((t - A[0]) / (B[0] - A[0]), 0, 1)); r = { x: lerp(A[1], B[1], u), y: lerp(A[2], B[2], u), a: lerp(A[3], B[3], u), L: lerp(A[4], B[4], u) }; }
      // the jab at 92.0 sets the whole blade ringing
      const gj = t - 92.0; if (gj > 0 && gj < 0.5) r.a += 0.05 * Math.exp(-gj * 9) * Math.sin(gj * 70);
      return r;
    }
    // the point d along the blade at time t (world)
    const a4BP = (t, d) => { const B = a4Blade(t); return [B.x + Math.cos(B.a) * d, B.y + Math.sin(B.a) * d]; };
    const A4CUT2 = 94.2, A4CUT3 = 95.4, A4MASK = 96.6, A4CATCH = 97.4, A4SNAP = 100.0, GD1 = 236, GD2 = 296, GDS = 266;
    // the five trades (time, where along the blade they meet, power): the four-armed block, the backhand, the jab into the
    // flat, the two-fisted hammer, the crossed block of the thrust — then the cuts, and the catch
    const GTR = [[90.6, 286, 2.4], [91.4, 230, 1.9], [92.0, 200, 2.0], [92.6, 270, 2.3], [93.2, 225, 2.1]];
    const GHITS = [...GTR.map(([h, d, p]) => [h, p, ...a4BP(h, d)]), [94.2, 2.6, ...gl(-105, 130)], [95.4, 2.6, ...gl(-60, 160)], [96.6, 2.4, ...gl(0, 0)], [97.4, 2.6, ...a4BP(97.4, GDS)]];
    /* his arms through the exchange: keyed striking points (local) [t, x, y, ang] — or, at a blow, [t, 'C', d, dx, dy, ang]:
       the point d along the blade at that moment (plus dx, dy), so the knuckles land exactly on it. Into a blow the key eases
       in (accelerating), out of one it eases out; the engine's arm physics add the elbow's trail and the shoulder's heave */
    const GAK = [
      // upper left: the crossed block; a backhand out across the blade; up overhead and the two-fisted hammer; rest
      [[90.0, -110, 140, 1.6], [90.42, 34, 58, 0.15], [90.6, 'C', 286, 30, 4, 0.1], [90.76, 40, 50, 0.0], [91.0, 26, 66, 0.15], [91.24, 44, 30, -0.6], [91.4, 'C', 230, 0, 0, 3.5], [91.56, -166, 36, 2.7], [92.1, -122, 104, 1.9], [92.42, -50, -56, -1.4], [92.6, 'C', 270, 3, -3, 2.0], [92.76, -98, 78, 2.2], [93.3, -112, 96, 1.7], [97.1, -110, 86, 1.6]],
      // upper right: the crossed block; back; overhead with the other for the hammer; rest
      [[90.0, 110, 150, 1.5], [90.42, -34, 64, 3.0], [90.6, 'C', 286, -30, 6, 3.1], [90.76, -26, 56, 3.2], [91.0, -20, 68, 3.0], [91.6, 92, 122, 1.8], [92.42, -36, -48, -1.6], [92.6, 'C', 270, -6, 5, 2.1], [92.76, -104, 86, 2.3], [93.4, 100, 112, 1.6], [96.9, 100, 108, 1.6]],
      // lower left: the crossed block; a straight jab into the flat of the blade; the cross block of the thrust; reaching
      [[90.0, -80, 200, 1.5], [90.42, 34, 112, 0.1], [90.6, 34, 112, 0.1], [91.0, 20, 118, 0.1], [91.82, -26, 140, 3.0], [92.0, 'C', 200, 0, 0, 3.0], [92.14, -126, 106, 3.0], [92.5, -70, 160, 2.0], [93.02, 30, 124, -0.2], [93.2, 'C', 225, 28, 2, -0.25], [93.36, 36, 116, -0.3], [93.65, -60, 150, 2.4], [94.0, -128, 138, 3.0], [94.2, -136, 140, 3.0]],
      // lower right: the crossed block; rest; the cross block; recoil from the first cut; reaching to grab
      [[90.0, 80, 200, 1.5], [90.42, -30, 116, 3.0], [90.6, -30, 116, 3.0], [91.0, -20, 120, 3.0], [92.0, 70, 168, 1.7], [93.0, -38, 126, 3.4], [93.2, 'C', 225, -36, -2, 3.45], [93.36, -30, 118, 3.5], [93.7, -20, 140, 3.0], [94.6, 110, 170, 1.6], [95.2, -40, 166, 3.2], [95.4, -62, 162, 3.3]],
    ];
    function a4GTrack(keys, t) {
      const pt = (K) => { if (K[1] !== 'C') return [K[1], K[2], K[3]]; const [lx, ly] = lg(...a4BP(K[0], K[2])); return [lx + K[3], ly + K[4], K[5]]; };
      let i = 0; while (i < keys.length - 1 && keys[i + 1][0] <= t) i++;
      const A = pt(keys[i]), Bk = keys[i + 1];
      if (!Bk || t <= keys[i][0]) return A;
      const B = pt(Bk), u = clamp((t - keys[i][0]) / (Bk[0] - keys[i][0]), 0, 1), e = Bk[1] === 'C' ? eic(u) : keys[i][1] === 'C' ? eoc(u) : eio(u);
      return [lerp(A[0], B[0], e), lerp(A[1], B[1], e), lerp(A[2], B[2], e)];
    }
    // his lean (local units, + away from the blade): rocked back by what he blocks and by the cuts, winding up away before
    // each of his own blows and throwing his weight into them
    const a4Bump = (g) => (g > 0 ? (1 - Math.exp(-g * 25)) * Math.exp(-g * 3) : 0);
    function a4GLean(t) {
      let l = 0;
      for (const h of [90.6, 93.2, 97.4]) l += 12 * a4Bump(t - h);
      for (const h of [94.2, 95.4]) l += 9 * a4Bump(t - h);
      for (const h of [91.4, 92.0, 92.6]) { const d = h - t; if (d > 0 && d < 0.3) l += 7 * Math.sin((1 - d / 0.3) * PI / 2); l -= 14 * a4Bump(t - h); }
      return l;
    }
    // the hands on the blade (97.4–100.6): the palm on it, the hand square across it; d along it, sd which side
    function a4Grip(t, d, sd, B) {
      const ga = B.a + sd * PI / 2, [bx, by] = [B.x + Math.cos(B.a) * d, B.y + Math.sin(B.a) * d], [lx, ly] = lg(bx, by);
      return { x: lx - Math.cos(ga) * 5.5, y: ly - Math.sin(ga) * 5.5, ang: ga };
    }
    function a4GArms(t) {
      const near = Math.min(...GHITS.map((h) => Math.abs(t - h[0]))), dr = 5 * clamp(near / 0.35, 0, 1);
      const arms = GAK.map((keys, k) => {
        const [x, y, ang] = a4GTrack(keys, t);
        const pose = k === 2 && t > 93.75 ? a4PL('fist', 'claw', lin(93.75, 93.95, t)) : k === 3 && t > 94.75 ? a4PL('fist', 'grab', lin(94.9, 95.25, t)) : a4PL('fist', 'grab', dr > 2 ? 0.2 + 0.2 * z5N(t * 1.4, k + 7) : 0);
        return { x: x - Math.cos(ang) * 10.8 + z5N(t * 0.9, k * 3) * dr, y: y - Math.sin(ang) * 10.8 + z5N(t * 0.8, k * 3 + 1) * dr, ang, pose, front: true };
      });
      if (t >= A4CUT2) { const [x, y, ang] = a4GTrack(GAK[2], A4CUT2); arms[2] = { x: x - Math.cos(ang) * 10.8, y: y - Math.sin(ang) * 10.8, cut: true, front: true }; }
      if (t >= A4CUT3) { const [x, y, ang] = a4GTrack(GAK[3], A4CUT3); arms[3] = { x: x - Math.cos(ang) * 10.8, y: y - Math.sin(ang) * 10.8, cut: true, front: true }; }
      // the catch: both upper hands to the blade, open, and shut on it; the strain; the snap twists them apart
      const cg = eoc(lin(97.22, 97.4, t));
      if (cg > 0) {
        const B = a4Blade(t), close = eoc(lin(97.36, 97.5, t)), strain = lin(97.5, 100.0, t), snap = t >= A4SNAP ? eoc(Math.min(1, (t - A4SNAP) / 0.25)) : 0;
        const push = 7 * a4Bump(t - A4CATCH) + 2 * z5Sh(t, 31) * strain;      // the blade's force taken in the arms
        [[0, GD1, 1], [1, GD2, -1]].forEach(([k, d, sd]) => {
          const G = a4Grip(t, d, sd, B), A = arms[k], tr = z5Sh(t * 1.3, k * 5) * (0.6 + 1.6 * strain);
          const tw = snap * (k === 0 ? 1 : -1);                                   // the snap: one hand down and round, one up
          A.x = lerp(A.x, G.x + Math.cos(B.a) * push + tw * -14, cg) + tr * (cg > 0.9 ? 1 : 0); A.y = lerp(A.y, G.y + Math.sin(B.a) * push + tw * 22, cg) + tr * 0.6 * (cg > 0.9 ? 1 : 0);
          A.ang = lerp(A.ang, G.ang + tw * 0.6, cg);
          const tight = 0.08 * strain + 0.04 * Math.sin(t * 9 + k);
          A.pose = a4PL({ curl: 0.15, thumb: 0.1, spread: 0.95 }, { curl: 0.8 + tight, thumb: 0.75, spread: 0.1 }, close);
          if (snap > 0) A.pose = a4PL(A.pose, k === 0 ? 'fist' : { curl: 0.3, thumb: 0.2, spread: 0.9 }, snap);
        });
      }
      return arms;
    }
    // a severed forearm, falling: the burning elbow end at (x, y), pointing a — the vambrace and the hand gone slack
    function a4Limb(x, y, s, a, t, len) {
      const ex = x + Math.cos(a) * len * s, ey = y + Math.sin(a) * len * s;
      a4Fore(x, y, ex, ey, s, 0.7, 0.6);
      discF(x, y, 13 * s, 103); discF(x, y, 8 * s, 105); discF(x, y, 4 * s, 22);
      glow(x, y, 26 * s, T_EMBER, 0.6);
      sHand(ex, ey, s, a + Math.sin(t * 3) * 0.1, Object.assign(a4P({ curl: 0.45, thumb: 0.3, spread: 0.6 }), { heat: 0.3 }), t);
    }
    // the severed arms: [time cut, cut point (local), initial velocity, spin, splash time]
    const GLIMBS = [[A4CUT2, -105, 130, -90, -60, -2.4, 94.95], [A4CUT3, -60, 160, 70, -50, 2.0, 96.1]];
    const a4LimbAt = (L, t) => { const g = t - L[0], [wx, wy] = gl(L[1], L[2]); return [wx + L[3] * g, wy + L[4] * g + 260 * g * g, (L[0] === A4CUT2 ? 2.4 : 0.5) + L[5] * g]; };
    /* the giants' world through the camera V = { k, ox, oy }: the sky and the dark ocean under the cloud cover, its spires,
       the fire of the blade on the water; the cloud cover with a hole blown through it, miles across, at every blow (dawn
       light pours down through each in shafts); the burning chasm cut through the sea; him; the blade; the hits.
       o: arms, push, shake, tilt, nod, roar, eyes, blade, cracks, noBlade, kink (the blade bent at his grip) */
    function a4Giant(t, V, o) {
      o = o || {};
      const k = V.k, X = (wx) => 240 + (wx - V.ox) * k, Y = (wy) => 135 + (wy - V.oy) * k, WX = (x) => V.ox + (x - 240) / k, WY = (y) => V.oy + (y - 135) / k;
      const B = o.blade || a4Blade(t), px = X(B.x), py = Y(B.y), hzY = Y(GSEA);
      // where the blade meets the horizon (its fire on the water under it)
      const LX = Math.abs(Math.sin(B.a)) > 0.05 ? px + Math.cos(B.a) * (hzY - py) / Math.sin(B.a) : px;
      belowWorld(t, hzY, V.ox * 1.5 + 900, 0.85, [97, 98, 101, 102, 103], clamp(LX, -40, W + 40));
      // the cloud cover, its belly lit red from below; every heavy hit blows a ring in it, miles across
      const holes = []; for (const [h, p, hx] of GHITS) { const g = t - h; if (g > 0) holes.push([hx, (50 + 210 * eoc(Math.min(1, g / 1.0))) * p / 2.4, g]); }
      for (let x = 0; x < W; x++) {
        const wx = WX(x), bot = Y(56 + 22 * fbm(wx, 0, 70, 3, 4851) + 7 * vn(wx, 0, 9, 4855)), y1 = Math.min(H - LB, Math.ceil(bot));
        for (let y = LB; y < y1; y++) {
          const wy = WY(y), dd = (bot - y) / k, n = vn(wx, wy, 9, 4852), b = bay(x, y);
          let c = dd < 1.5 ? 104 : dd < 3.5 ? (b < 0.5 ? 103 : 102) : dd < 8 + 6 * n ? (b < 0.4 ? 102 : 121) : dd < 16 + 8 * n ? (b < 0.5 ? 121 : 120) : n > 0.62 ? 120 : 97;
          for (const [hx, r, g] of holes) { const dx = (wx - hx) / r, dy = (wy - 40) / (r * 0.16), d = dx * dx + dy * dy; if (d < 1) { c = d > 0.85 ? (g < 0.6 ? 22 : 106) : d > 0.6 ? 15 : b < 0.5 ? 16 : 15; break; } else if (d < 1.25 && g < 1.2) { c = b < 0.5 ? 121 : 122; } }
          BUF[y * W + x] = c;
        }
      }
      // the dawn falling through the newest holes: shafts of light down to the sea
      for (const [hx, r, g] of holes.slice(-3)) {
        if (g > 3) continue;
        const a = 0.2 * Math.min(1, g * 3) * (1 - g / 3), x0 = X(hx), w0 = r * k * 0.55, y0 = Math.max(LB, fl(Y(48))), y1 = Math.min(H - LB, fl(hzY));
        for (let y = y0; y < y1; y++) { const q = (y - y0) / Math.max(1, y1 - y0), w = w0 * (0.6 + 0.6 * q), cx = x0 + q * 30 * k; for (let x = Math.max(0, fl(cx - w)); x < Math.min(W, cx + w); x++) { const e = 1 - Math.abs(x - cx) / w; if (vn(x * 0.3 + y * 0.1, g * 3, 3, 4856) > 0.35) tintI(y * W + x, x, y, T_WARM, a * e * (1 - q * 0.5)); } }
      }
      // the burning chasm cut through the sea toward us, the sea pouring over its lips
      for (let y = Math.max(LB, fl(hzY)); y < H - LB; y++) {
        const wy = WY(y), q = clamp((wy - GSEA) / 140, 0, 1), cxw = lerp(196, 140, q), half = 3 + (wy - GSEA) * 0.55, row = y * W;
        const xa = Math.max(0, fl(X(cxw - half - 4 / k))), xb = Math.min(W - 1, Math.ceil(X(cxw + half + 4 / k)));
        for (let x = xa; x <= xb; x++) {
          const wx = WX(x), d = Math.abs(wx - cxw) - half;
          if (d < 0) { const e = -d / half, n = vn(wx, wy, 5, 4857); BUF[row + x] = e < 0.08 ? 104 : e < 0.3 ? (n > 0.5 ? 102 : 103) : e < 0.65 ? (n > 0.6 ? 102 : 101) : n > 0.55 ? 98 : 101; continue; }
          if (d < 3 / k) BUF[row + x] = bay(x, y) < 0.5 ? 22 : 119;               // foam on the lip where the sea goes over
        }
      }
      // him: the arms (keyed, or given), rocked by the blows; the cut across his mask
      const arms = o.arms || a4GArms(t), maskCuts = t >= A4MASK ? [[-17, -9, 17, 13, Math.min(1, (t - A4MASK) * 8)]] : [];
      // the thrust at 93.2 drives him back through the sea
      const shove = 16 * eoc(lin(93.2, 93.5, t)) * (1 - eio(lin(93.6, 94.4, t)));
      const sh = o.shake || 0, roar = o.roar || 0;
      // the blade as it is now (straight, or bent at his grip as he bends it); drawn inside his hands while he holds it
      const bw = Math.max(2, 7 * k), bo = { form: 'lastlight', flare: 0.9, cracks: o.cracks || 0, surge: true };
      const drawBlade = () => {
        if (o.kink) { const [sx, sy] = [X(B.x + Math.cos(B.a) * GDS), Y(B.y + Math.sin(B.a) * GDS)]; bigBlade(px, py, B.a, GDS * k, bw, t, bo); bigBlade(sx, sy, B.a - o.kink, (B.L - GDS) * k, bw, t, bo); }
        else o.tip = bigBlade(px, py, B.a, B.L * k, bw, t, bo);
      };
      const holding = !o.noBlade && t >= 97.37 && t < A4SNAP;
      if (holding && arms[0] && arms[1]) {
        arms[0] = Object.assign({}, arms[0], { hold: () => drawBlade() });
        // the second hand: its palm went down over the blade — so draw the blade again, but only round that palm
        arms[1] = Object.assign({}, arms[1], { hold: (info) => { const R = 26 * GS * k, [cx, cy] = info.palm; A4SAVE.set(BUF); drawBlade(); for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > R * R) BUF[y * W + x] = A4SAVE[y * W + x]; } } });
      }
      const so = a4Sund(X(GM[0] + (o.push || 0) + shove), Y(GM[1]), GS * k, t, { third: 1, eyes: o.eyes || 1.4, heat: 0.9, crown: 0.75, rage: t >= A4MASK ? 1 : 0.4 + roar * 0.4, roar, shake: sh, tilt: o.tilt || 0, nod: o.nod || 0, lean: a4GLean(t), arms, maskCuts });
      // the sea in front of his waist (the shove throws up a bow wave)
      const wl = Y(GWL);
      if (wl < H - LB) for (let y = Math.max(LB, fl(wl)); y < H - LB; y++) for (let x = Math.max(0, fl(X(220))); x < W; x++) { const wy = WY(y), wx = WX(x), q = clamp((wy - GSEA) / 140, 0, 1), sw = Math.sin(wx * 0.06 / (0.2 + q) + t * 1.4 + wy * 0.9); let c = y - wl < 2 ? 22 : OCEAN[clamp(fl(q * 3.2) + (sw > 0.8 ? 1 : 0), 0, 3)]; if (Math.abs(x - LX) < 10 + q * 40 && sw > 0.3 && c !== 22) c = sw > 0.9 ? 103 : 102; BUF[y * W + x] = c; }
      if (shove > 1 && t < 94.4) { const g = t - 93.2; rocks(X(GM[0] - 60 + shove), wl, g, 14, 160 * k, 1.5 * k + 1, [117, 118, 119, 22], 4858, 200 * k, -PI / 2 - 0.5, 1.0); }
      // the severed arms falling, and the sea thrown up where they land
      for (const L of GLIMBS) { const g = t - L[0]; if (g < 0) continue; const [wx, wy, a] = a4LimbAt(L, Math.min(t, L[6])); if (t < L[6]) a4Limb(X(wx), Y(wy), GS * k, a, t, 70); for (let q = 0; q < 6; q++) { const gg = g - q * 0.04; if (gg < 0 || t > L[6]) continue; const [px2, py2] = a4LimbAt(L, L[0] + gg); P(X(px2), Y(py2), q < 2 ? 105 : 103); } const gs = t - L[6]; if (gs > 0 && gs < 1.6) { const sx = X(wx), sy = Y(GWL); rocks(sx, sy, gs, 26, 220 * k, 3 * k + 1, [117, 118, 119, 22], 4854 + L[0], 160 * k, -PI / 2, 1.2); shockRing(sx, sy, 10 + gs * 300 * k, 3 + gs * 50 * k, 3, [22, 119, 118], 1 - gs / 1.6); if (gs < 0.5) glow(sx, sy, 60 * k, T_WH, 0.5 * (1 - gs * 2)); } }
      // the blade (when he is not holding it)
      if (!o.noBlade && !holding) drawBlade();
      // the hits, each its own: sparks from the exact point of contact thrown along the blow
      for (const [h, p, hx, hy] of GHITS) {
        const g = t - h; if (g < 0 || g > 1.2) continue;
        const sx = X(hx), sy = Y(hy);
        megaHit(sx, sy, g, Math.min(2.4, p), PI + B.a, [22, 106, 103], 4860 + fl(h * 10));
        if (g < 1.0) shockRing(sx, Y(40), 20 + g * 700 * k, 4 + g * 80 * k, 3, [22, 21, 20], 1 - g);
        if (g < 1.2) rocks(X(170), Y(GSEA + 10), g, 10, 120 * k, 3 * k + 1, [97, 99, 122, 103], 4870 + fl(h * 10), 200 * k, -PI / 2, 2.4);
        // the backhand throws a fan of sparks off the flat; the jab rings the blade (light running along it); the hammer
        // blasts the sea where the blade goes in; the thrust grinds sparks off the crossed vambraces
        if (h === 91.4 && g < 0.5) for (let q = 0; q < 24; q++) { const a = PI + B.a + 0.6 + (ih(q, 1, 4861) - 0.5) * 1.2, v = (60 + 200 * ih(q, 2, 4861)) * k, x = sx + Math.cos(a) * v * g, y = sy + Math.sin(a) * v * g + 200 * g * g; lineP(x, y, x - Math.cos(a) * 5, y - Math.sin(a) * 5, q % 3 ? 106 : 22); }
        if (h === 92.0 && g < 0.45) for (let q = 0; q < 8; q++) { const d = (frac(q / 8 + g * 3) - 0.5) * 900 * k, x = sx + Math.cos(B.a) * d, y = sy + Math.sin(B.a) * d; glow(x, y, 16 * k + 4, T_WH, 0.5 * (1 - g / 0.45)); }
        if (h === 93.2 && g < 0.6) for (let q = 0; q < 14; q++) { const a = PI + B.a + (ih(q, fl(t * 30), 4862) - 0.5) * 2.4, L = (8 + 30 * ih(q, 3, 4862)) * k; lineP(sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L, q % 2 ? 22 : 105); }
      }
      { const g = t - 92.75; if (g > 0 && g < 1.4 && k < 1.2) { const x = X(300), y = Y(GSEA + 8); rocks(x, y, g, 30, 300 * k, 3 * k + 1, [117, 118, 119, 22], 4881, 160 * k, -PI / 2, 1.0); shockRing(x, y, 10 + g * 320 * k, 3 + g * 50 * k, 3, [22, 119, 118], 1 - g / 1.4); if (g < 0.4) glow(x, y, 70 * k, T_WH, 0.5 * (1 - g / 0.4)); } }
      // his waterline: the sea pushed out in a ring from him on every hit
      for (const [h] of GHITS) { const g = t - h; if (g > 0 && g < 1.4) shockRing(X(GM[0]), Y(GWL), 20 + g * 260 * k, 3 + g * 20 * k, 2, [22, 119, 118], 1 - g / 1.4); }
      return { so, X, Y, B, px, py };
    }
    const a4GK = (t) => kick(t, GHITS.map(([h, p, x, y]) => [h, p * 0.8, Math.atan2(y - 300, x - 160)]));
    // G1 90.6–91.4: wide: the blade comes up out of the chasm into his four crossed arms; they give, and hold
    shot(90.6, 91.4, (lt, t) => { a4Giant(t, { k: 1, ox: 250, oy: 140 }, { push: 10 * eoc(Math.min(1, lt * 3)), tilt: -0.05 * a4Bump(lt) }); shk(lt < 0.4 ? 7 : 1); a4Cam(1.02, 0, 240, 135, a4GK(t)); });
    // G2 91.4–92.0: close on his shoulder: the backhand — the back of his fist across the flat, the blade knocked away
    shot(91.4, 92.0, (lt, t) => { a4Giant(t, { k: 1.75, ox: 262, oy: 116 }, { tilt: 0.06 - 0.05 * a4Bump(lt), nod: 1 }); shk(lt < 0.3 ? 6 : 1.2); a4Cam(1.0, -0.04, 240, 135, a4GK(t)); });
    // G3 92.0–92.45: low and tilted, beside the blade: the jab into its flat sets it ringing end to end
    shot(92.0, 92.45, (lt, t) => { a4Giant(t, { k: 1.3, ox: 236, oy: 152 }, { tilt: -0.04, nod: 2 }); shk(lt < 0.3 ? 6 : 1.2); a4Cam(1.0, 0.08, 240, 135, a4GK(t)); });
    // G4 92.45–93.0: wide: both fists overhead and down — the hammer drives it into the sea
    shot(92.45, 93.0, (lt, t) => { a4Giant(t, { k: 0.78, ox: 260, oy: 150 }, { nod: 3 * eio(lin(92.45, 92.6, t)) }); shk(t > 92.6 && t < 92.9 ? 6 : 1.5); a4Cam(1.0, 0, 240, 135, a4GK(t)); });
    // G5 93.0–93.6: tight on his chest: the thrust, taken on his crossed lower forearms; it drives him back through the sea
    shot(93.0, 93.6, (lt, t) => { a4Giant(t, { k: 1.7, ox: 318, oy: 176 }, { tilt: 0.04, nod: -2 * a4Bump(t - 93.2) }); shk(t > 93.2 && t < 93.5 ? 7 : 1.5); a4Cam(1.0, 0.03, 240, 135, a4GK(t)); });
    // G6 93.6–94.15: in the chasm, close: the hero, burning, hauls the blade back for everything it has
    function a4HeroPit(t, S, hx, hy, o) {
      a4Wall(-1, 70, 300 + t * 20, t, 1, 1000, 4891, true);
      a4Wall(1, 410, 300 + t * 20, t, 1, 1000, 4892, true);
      return a4Last(hx, hy, S, t, o);
    }
    shot(93.6, 94.15, (lt, t) => {
      a4Deep(300, t, 1, 1000);
      const B = a4Blade(t), S = 3.4, hx = 210 + a4Tw(t, 16) * 1.5, hy = 170;
      const a = a4HeroPit(t, S, hx, hy, { eyes: 'glow', mouth: 2, sw: -1.9 + (B.a + 1.45) * 0.6, sq: -0.1 + 0.2 * Math.sin(t * 9), legs: [0, 1, 1, 0] });
      bigBlade(a.hand[0], a.hand[1], B.a - 0.3, 600, 6, t, { form: 'lastlight', flare: 1, surge: true });
      a4Embers(t, 30, 140, 4893, [106, 104]);
      shk(2.5); a4Cam(1.04, -0.04, 240, 135);
    });
    // G7 94.15–95.3: the sweep takes the lower left arm off at the elbow; it falls into the sea
    shot(94.15, 95.3, (lt, t) => { a4Giant(t, { k: 1.12, ox: 290, oy: 160 }, { shake: t > A4CUT2 ? 1.2 : 0, tilt: t > A4CUT2 ? 0.06 * eoc(Math.min(1, (t - A4CUT2) * 3)) : 0, roar: 0.4 * a4Bump(t - A4CUT2) }); shk(t > A4CUT2 && t < 94.6 ? 7 : 1.5); a4Cam(1.0, 0, 240, 135, a4GK(t)); });
    WHIPS.push([95.28, 0]);
    // G8 95.3–96.5: and the lower right; he roars, the camera pushed in on it
    shot(95.3, 96.5, (lt, t) => {
      const roar = sstep(95.55, 95.85, t) * (1 - sstep(96.3, 96.5, t) * 0.5), push = eio(lin(95.6, 96.45, t));
      a4Giant(t, { k: lerp(1.0, 1.8, push), ox: lerp(260, GM[0], push), oy: lerp(150, GM[1] + 20, push) }, { roar, shake: roar * 1.4, nod: -roar * 3 });
      shk(roar * 3 + (t - A4CUT3 > 0 && t - A4CUT3 < 0.4 ? 5 : 0)); a4Cam(1.0, 0, 240, 135, a4GK(t));
    });
    // G9 96.5–97.3: on his face: the blade goes across the mask; the seam of fire widens
    shot(96.5, 97.3, (lt, t) => {
      const g = t - A4MASK, recoil = g > 0 ? z5Knock(g, 0.12, 9, 4) : 0;
      a4Giant(t, { k: 2.4, ox: GM[0], oy: GM[1] + 12 }, { tilt: recoil, shake: g > 0 ? 1.5 : 0.3, roar: g > 0 ? 0.3 * Math.exp(-g * 3) : 0 });
      shk(g > 0 && g < 0.4 ? 6 : 1); a4Cam(1.0, 0, 240, 135, a4GK(t));
    });
    // G10 97.3–98.2: he catches it in his two hands — the palms meet it, the fingers close over it — and it stops dead;
    // sparks grind out of each grip; his arms give a little, and hold
    function a4GripFx(r, t, g, amt) {
      for (const d of [GD1, GD2]) {
        const [bx, by] = a4BP(t, d), sx = r.X(bx), sy = r.Y(by);
        for (let q = 0; q < 8; q++) { const f = frac(ih(q, 1, 4901 + d) + t * 2.6), a = r.B.a + PI + (ih(q, 2, 4901 + d) - 0.5) * 2, v = 60 * r.Y(1) / r.Y(1); const x = sx + Math.cos(a) * f * 50 * amt, y = sy + Math.sin(a) * f * 50 * amt + f * f * 30; P(x, y, f < 0.4 ? 22 : 106); }
        glow(sx, sy, 40 * amt, T_EMBER, 0.45 * amt);
      }
    }
    shot(97.3, 98.2, (lt, t) => {
      const g = t - A4CATCH, B = a4Blade(t); if (g > 0) B.a += z5Sh(t, 21) * 0.004;
      const r = a4Giant(t, { k: 1.45, ox: 300, oy: 108 }, { blade: B, cracks: g > 0 ? 0.15 * g : 0, shake: g > 0 ? 0.8 : 0, eyes: 1.7 });
      if (g > 0) a4GripFx(r, t, g, 1);
      shk(g > 0 ? (g < 0.4 ? 8 : 2.5) : 1); a4Cam(1.0, 0, 240, 135, a4GK(t));
    });
    // G11 98.2–98.9: the hero, everything pouring out of it into the blade, the cracks in it widening
    shot(98.2, 98.9, (lt, t) => {
      a4Deep(300, t, 1, 1000);
      const S = 3.6, hx = 214 + a4Tw(t, 17) * 2.2, hy = 176;
      const a = a4HeroPit(t, S, hx, hy, { eyes: 'glow', mouth: 2, sw: -1.62, sq: 0.12 + 0.06 * Math.sin(t * 13), legs: [0, 2, 2, 0], power: 1.3 });
      bigBlade(a.hand[0], a.hand[1], -1.25 + z5Sh(t, 22) * 0.01, 600, 6.5, t, { form: 'lastlight', flare: 1, surge: true, cracks: 0.25 });
      a4Embers(t, 40, 160, 4902, [106, 104]);
      shk(3); a4Cam(1.06 + lt * 0.05, 0.03, 220, 160);
    });
    // G12 98.9–100.0: the hands on the blade, close: it cracks along its length, light leaking out, bending where he holds it
    shot(98.9, 100.0, (lt, t) => {
      const B = a4Blade(t), u = lin(98.9, 100.0, t); B.a += z5Sh(t, 23) * 0.006 * (1 + u * 2);
      const r = a4Giant(t, { k: 2.3, ox: 322, oy: 132 }, { blade: B, eyes: 2, shake: 0.6 + u, roar: 0.2 * u, cracks: 0.3 + u * 0.7, kink: 0.12 * eic(u) });
      // light leaking through the cracks round his grip
      const [bx, by] = a4BP(t, GDS), sx = r.X(bx), sy = r.Y(by);
      for (let k = 0; k < 16 * u; k++) { const a = ih(k, 1, 4903) * TAU, L = 20 + 60 * u * ih(k, 2, 4903); lineF(sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L, (x, y, q) => { if (bay(x, y) < (1 - q) * u) P(x, y, 22); }); }
      glow(sx, sy, 60 + 80 * u, T_WH, 0.3 + 0.4 * u);
      a4GripFx(r, t, 0, 0.5 + 0.5 * u);
      shk(1 + u * 4); a4Cam(1.0, 0.02 * u, 240, 135);
    });
    // G13 100.0–100.6: wide: snapped — his hands wrench apart, the long half tumbles out of them and comes apart in the air,
    // pieces the size of mountains falling into the sea
    function a4Frag(x, y, L, w, a, lit) {
      const ca = Math.cos(a), sa = Math.sin(a), nx = -sa * w, ny = ca * w, tx = x + ca * L, ty = y + sa * L, bx = x - ca * L * 0.6, by = y - sa * L * 0.6;
      z5Tri(tx, ty, bx + nx, by + ny, bx - nx * 0.6, by - ny * 0.6, 102); z5Tri(tx, ty, bx + nx * 0.6, by + ny * 0.6, bx - nx * 0.2, by - ny * 0.2, lit ? 106 : 104);
      lineP(tx, ty, bx + nx, by + ny, 107); glow(x, y, L * 0.8, T_EMBER, 0.3);
    }
    shot(100.0, 100.6, (lt, t) => {
      const g = t - A4SNAP;
      const r = a4Giant(t, { k: 0.85, ox: 262, oy: 132 }, { noBlade: true, eyes: 2, roar: 0.6 * Math.exp(-g * 2) });
      const B = a4Blade(t), [bx, by] = a4BP(t, GDS), sx = r.X(bx), sy = r.Y(by);
      const back = eic(Math.min(1, g / 0.6));
      bigBlade(r.px, r.py + back * 120, B.a, Math.hypot(sx - r.px, sy - r.py) * (1 - back * 0.3), 7 * 0.85, t, { form: 'lastlight', flare: 0.6, cracks: 0.6 });
      for (let k = 0; k < 9; k++) {
        const d = 40 + k * 110, br = clamp((g - 0.04 * k) * 3, 0, 1), px0 = sx + Math.cos(B.a) * d * 0.85, py0 = sy + Math.sin(B.a) * d * 0.85;
        const px = px0 + (ih(k, 1, 4904) - 0.5) * 160 * g + 30 * g, py = py0 + 520 * g * g + (ih(k, 2, 4904) - 0.5) * 60 * g, rot = B.a + (ih(k, 3, 4904) - 0.5) * 3 * g;
        if (py > H + 60) continue;
        a4Frag(px, py, 30 + 26 * ih(k, 4, 4904), 7 + 6 * ih(k, 5, 4904), rot, br > 0.5);
        if (br > 0) for (let q = 1; q < 4; q++) P(px - q * 3 * Math.cos(rot), py - q * 9, 104);
      }
      if (g < 0.4) { glow(sx, sy, 200 * (1 - g * 2.5), T_WH, 0.8); }
      megaHit(sx, sy, g, 2.6, B.a, [22, 106, 103], 4905);
      rocks(sx, sy, g, 40, 300, 3, [104, 106, 107, 22], 4906, 300, B.a, 2.2);
      shk(g < 0.5 ? 8 : 3); a4Cam(1.0, 0, 240, 135, kick(t, [[A4SNAP, 3, B.a]]));
    });
    /* ============================================================== 11 · the floor of the world (100.8–104.0)
       Point blank, his third eye blazing over the hero in the chasm: one fist, and it is driven straight down through the
       floor of the world, through the rock beneath it, into the dark; its fire goes out on the way down. */
    shot(100.6, 101.25, (lt, t) => {
      const T = a4Stop(t, [100.8], 0.07), g = t - 100.8, hitv = g >= 0, wind = eio(lin(100.6, 100.72, T)), strike = eic(lin(100.7, 100.8, T)), drive = hitv ? eic(Math.min(1, (T - 100.8) / 0.45)) : 0, lean = eoc(lin(100.6, 100.75, t));
      a4Deep(800 + drive * 300, t, 0.8, 1400);
      a4Wall(-1, 60, 820 + drive * 300, t, 0.8, 1400, 4911, true);
      a4Wall(1, 420, 820 + drive * 300, t, 0.8, 1400, 4912, true);
      // his face leaning in over it, the brother's eye in his brow blazing; he drops his weight into the blow
      const my = lerp(-10, 104, lean) - drive * 260 + 10 * strike;
      a4Sund(340, my, 2.3, t, { third: 1, eyes: 2, heat: 1, crown: 0.75, rage: 1, roar: 0.3 + 0.4 * strike, body: false, maskCuts: [[-17, -9, 17, 13, 1]], nod: 3 + 3 * strike, tilt: -0.08 * wind + 0.06 * strike });
      glow(340, my - 16 * 2.3, 130, T_MAG, 0.7); glow(340, my - 16 * 2.3, 40, T_WH, 0.5);
      // the hero, with what is left of the blade, looking up: crushed flat by the blow on the hit frame, then driven down
      // through the floor, stretched along its fall
      const S = 3.0, hx = 170 + a4Tw(t, 18) * (hitv ? 0 : 1), hy = 176 + drive * 260;
      const sq = hitv ? (T - 100.8 < 0.001 ? 0.6 : -0.35 * Math.min(1, (T - 100.8) * 8)) : 0;
      const a = a4Last(hx, hy, S, t, { eyes: hitv ? 'closed' : 'wide', mouth: 2, sw: -1.2, still: hitv, power: 1 - drive * 0.5, ang: drive * 0.4, sq });
      bigBlade(a.hand[0], a.hand[1], -1.2, 70, 5, t, { form: 'lastlight', flare: 0.6, cracks: 0.6 });
      // the fist: cocked up and back, then down onto it — the knuckles on its crown on the hit frame — and on down with it
      const fa = PI * 0.62, C = [hx + 2, hy - 8 * S * (1 - 0.4 * Math.max(0, sq))];
      const kx = hitv ? C[0] + 6 * drive : lerp(lerp(C[0] + 120, C[0] + 165, wind), C[0], strike), ky = hitv ? C[1] + 10 * Math.min(1, (T - 100.8) * 10) : lerp(lerp(C[1] - 70, C[1] - 105, wind), C[1], strike);
      a4Arm(kx - Math.cos(fa) * 10.8 * 3.2, ky - Math.sin(fa) * 10.8 * 3.2, 3.2, fa, 'fist', 1, t, { bend: 0.5 - 0.3 * strike, side: 1, rim: 1 });
      if (strike > 0.2 && !hitv) streaks(fa, 30, t, 4000, 103, 120, 4915, [0, LB, W, H - 2 * LB]);
      if (hitv) { megaHit(C[0], C[1], g, 3.3, PI / 2, [22, 75, 103], 4913); streaks(PI / 2, 40, t, 4000, 103, 120, 4914, [0, LB, W, H - 2 * LB]); }
      shk(hitv && g < 0.6 ? 9 : 1); a4Cam(1.0, 0, 240, 135, kick(t, [[100.8, 3.5, PI / 2]]));
    });
    // through the rock beneath the world, and then nothing but the dark; its fire going out, plain and cracked again, a
    // broken hilt in its hand
    shot(101.25, 104.0, (lt, t) => {
      const u = lin(101.25, 104.0, t), rockU = lin(101.25, 102.2, t), fade = eio(lin(102.2, 103.7, t));
      BUF.fill(0, LB * W, (H - LB) * W);
      // strata of rock rushing up past it as it is driven through them, then none
      if (rockU < 1) for (let k = 0; k < 7; k++) { const y = H - LB - frac(k / 7 + rockU * 2.4) * 300 + 40; if (y < LB - 40 || y > H - LB + 40) continue; for (let yy = fl(y); yy < y + 18; yy++) if (yy >= LB && yy < H - LB) for (let x = 0; x < W; x++) { const hole = Math.abs(x - 240) < 30 + (yy - y) * 0.5; if (!hole) BUF[yy * W + x] = (yy - y) < 2 ? 99 : vn(x, yy, 6, 4921 + k) > 0.5 ? 97 : 96; } rocks(240, y, frac(rockU * 2.4 + k / 7) * 0.6, 10, 200, 3, [97, 98, 99, 103], 4922 + k, -400, -PI / 2, 2.8); }
      const S = lerp(3.0, 1.6, eio(u)), hx = 240 + Math.sin(t * 1.3) * 8 * u, hy = lerp(60, 150, eoc(Math.min(1, u * 2))) + 26 * eic(u) + Math.sin(t * 2) * 2;
      for (let k = 0; k < 40; k++) { const sp = 900 * (1 - u * 0.7), y = H - LB - frac(ih(k, 1, 4925) + t * sp / 218) * 218, x = ih(k, 2, 4925) * W; if (bay(fl(x), fl(y)) < 0.8 - u * 0.5) { P(x, y, k % 3 ? 97 : 121); P(x, y + 1, 96); } }
      if (rockU < 1) streaks(-PI / 2, 30, t, 3000 * (1 - rockU), 103, 90, 4924, [0, LB, W, H - 2 * LB]);
      const burning = 1 - eio(lin(101.8, 102.9, t));
      glow(hx, hy, 60 * S * burning + 14 * (1 - fade), burning > 0.1 ? T_FIRE : T_WARM, 0.45 * burning + 0.2 * (1 - fade));
      const form = burning > 0.5 || (burning > 0.15 && fl(t * 15) % 2) ? 'lastlight' : undefined;
      const a = actor(HERO3({ form, eyes: 'closed', sword: null, legs: z5Limp(t, 1.6), cracks: 0.9, sq: -0.05 }), hx, hy, S, 0.3 + u * 0.5 + Math.sin(t * 0.8) * 0.1, false, { still: true });
      if (burning > 0.2) aura(t, LASTF, 4 * S * burning, { sparks: fl(12 * burning), rise: -1.5 });
      a4Sword(a.hand[0], a.hand[1], 0.3 + u * 0.5 + 0.9, S * 0.9, null, false, true);
      // embers peeling off it and falling behind (upward, as it drops)
      for (let k = 0; k < 20; k++) { const q = frac(ih(k, 1, 4923) + t * 1.2), x = hx + (ih(k, 2, 4923) - 0.5) * 40, y = hy - q * 120; if (bay(fl(x), fl(y)) < (1 - q) * (burning * 0.8 + 0.2)) P(x, y, burning > 0.3 ? 104 : 37); }
      // the light goes out
      tintAll(T_DARK, 0.25 + 0.6 * fade);
      a4Cam(1.0, 0, 240, 135);
    });
  }

  /* ================================================================ acts V and VI — infinite, and the cost (104–180) */
  {
  /* -------------------------------------------------------------- b4 helpers */
  const B4_SM = [85, 83, 22];
  const B4_FORMS = [undefined, 'storm', 'zenith', 'nova', 'lastlight', 'infinite'];
  // the sword with any blade length (2.5..30 units) and an optional broken, jagged end: swapped in for spSword while one of
  // these heroes is built, so the arm still raises and follows its hilt like the real thing
  let b4SwL = 30, b4SwBroken = 0, b4SwCols = null;
  function b4SpSword(px, py, ang, cols) {
    const ca = Math.cos(ang), sa = Math.sin(ang), L = b4SwL, R = Math.ceil(Math.max(7, L + 2));
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const fx = dx + 0.5, fy = dy + 0.5, u = fx * ca + fy * sa, v = -fx * sa + fy * ca, av = Math.abs(v);
      let c = -1;
      if (u >= -6 && u < -4.5 && av <= 1.4) c = 58;
      else if (u >= -4.5 && u < 0.5 && av <= 1.0) c = 38;
      else if (u >= 0.5 && u < 2.5 && av <= 4.2) c = av > 3.2 ? 51 : 58;
      else if (u >= 2.5 && u < L) {
        // a clean point, or a snapped end: the edge zig-zags across the blade
        const end = b4SwBroken ? L - (Math.abs(frac(v * 0.9 + 0.3) - 0.5) * 3.2) : L;
        const tw = !b4SwBroken && u > L - 5 ? (L - u) * 0.36 : 1.8;
        if (u < end && av <= tw) c = b4SwCols ? (v < -0.6 ? 22 : b4SwCols[fl(frac(u * 0.08) * b4SwCols.length)]) : (v < -0.7 ? 22 : u < 5 ? 33 : 34);
        if (b4SwBroken && u < end && u > end - 1.2 && av <= tw) c = 94;
      }
      if (c >= 0) sp(px + dx, py + dy, c, 2);
    }
  }
  // a hero with a short (or broken) blade; returns actor()'s result with tip moved to the real end of the blade
  function b4Hero(o, x, y, S, ang, flip, opt, swl, broken, cols) {
    const keep = spSword; spSword = b4SpSword; b4SwL = swl; b4SwBroken = broken ? 1 : 0; b4SwCols = cols || null;
    let r;
    try { r = actor(HERO3(o), x, y, S, ang, flip, Object.assign({ noSmear: true }, opt || {})); } finally { spSword = keep; }
    const sw = o.sword || 0, da = (flip ? PI - sw : sw) + ang;
    r.tip = [r.hand[0] + Math.cos(da) * swl * S, r.hand[1] + Math.sin(da) * swl * S];
    return r;
  }
  // tint the last stamped sprite (only its own pixels)
  function b4TintSprite(T, a) {
    if (SMB[2] < SMB[0] || a <= 0) return;
    for (let y = SMB[1]; y <= SMB[3]; y++) for (let x = SMB[0]; x <= SMB[2]; x++) { const i = y * W + x; if (SMASK[i]) tintI(i, x, y, T, a); }
  }
  // wings of one element: three ranks of feathers on raised arms either side of (x, y), like z5Wings but recoloured and
  // turned: set 0 prism, 1 nova flame, 2 storm lightning, 3 last light; rot turns the arms, len stretches them
  function b4Wings(x, y, s, t, spread, flap, set, rot, len) {
    if (spread <= 0.02) return;
    const amp = flap === undefined ? 0.24 : flap, sh = fl(t * 8), f = fl(t * 30);
    for (const sd of [-1, 1]) {
      const beat = z5Beat(t) * amp, arm = -0.78 - beat + (1 - spread) * 1.3 + (rot || 0), ax = Math.cos(arm) * sd, ay = Math.sin(arm), Lw = 40 * s * (0.35 + 0.65 * spread) * (len || 1);
      const RANKS = [[9, 1, 0], [8, 0.62, 1], [7, 0.36, 2]];
      for (const [N, ln, rank] of RANKS) for (let j = N - 1; j >= 0; j--) {
        const u = (j + 0.6) / N, bx = x + ax * Lw * u, by = y + ay * Lw * u - Math.sin(u * PI) * 5 * s;
        const bu = z5Beat(t - 0.12 * u) * amp, fr = lerp(PI / 2 - 0.12, -0.15 - bu * 1.5, Math.pow(u, 1.25)) - (1 - spread) * 0.5 - (rot || 0) * 0.5 * u, fa = sd > 0 ? fr : PI - fr;
        let L = s * (15 + 30 * u) * ln * (0.45 + 0.55 * spread) * (len || 1), w = s * (4.4 - rank * 0.8);
        if (set === 2) {
          // lightning: each feather a bolt from root to tip, re-struck every other frame
          if (rank === 2) continue;
          const tx = bx + Math.cos(fa) * L, ty = by + Math.sin(fa) * L;
          bolt(bx, by, tx, ty, j * 7 + rank * 31 + fl(f / 2) * 3 + (sd > 0 ? 0 : 99), rank === 0 ? 2 : 1, rank === 0 ? 91 : 90, 89, 0.3);
          continue;
        }
        if (set === 1 || set === 3) L *= 0.85 + 0.3 * vn(j * 3 + rank * 17, t * 9, 1, 2101 + (sd > 0 ? 0 : 5));
        const fill = set === 0 ? (rank === 0 ? PRISM[(j + sh) % 7] : rank === 1 ? 60 : 22)
          : set === 1 ? (rank === 0 ? ((j + sh) % 3 ? 105 : 106) : rank === 1 ? 109 : 108)
            : (rank === 0 ? ((j + sh) % 3 ? 103 : 104) : rank === 1 ? 105 : 107);
        const rim = set === 0 ? (rank === 0 ? 22 : rank === 1 ? 59 : 60) : set === 1 ? (rank === 0 ? 104 : 110) : (rank === 0 ? 101 : 103);
        z5Kite(bx - Math.cos(fa) * 1.2, by - Math.sin(fa) * 1.2, fa, L + 2.4, w + 1.1, rim);
        z5Kite(bx, by, fa, L, w, fill);
        if (rank === 0) lineP(bx, by, bx + Math.cos(fa) * L * 0.8, by + Math.sin(fa) * L * 0.8, set === 0 ? 22 : 107);
      }
    }
  }
  // the four orbs: amt 0 (embers) .. 1 (orbs) .. 2 (blazing, with flares and comet tails)
  function b4Orbs(cx, cy, R, t, r, tilt, front, amt, spin, which) {
    for (let k = 0; k < 4; k++) {
      if (which && !which[k]) continue;
      const sp_ = spin || 2.4, a = t * sp_ + k * TAU / 4, z = Math.sin(a);
      if ((z > 0) !== front) continue;
      const x = cx + Math.cos(a) * R, y = cy + z * R * tilt, rr = r * (0.98 + 0.14 * z);
      if (amt > 1.05) for (let q = 1; q <= 5; q++) { const a2 = a - q * 0.07 * Math.sign(sp_), x2 = cx + Math.cos(a2) * R, y2 = cy + Math.sin(a2) * R * tilt; if (bay(fl(x2), fl(y2)) < 1 - q / 6) discF(x2, y2, rr * (1 - q / 7), ORB[k][q < 2 ? 2 : 1]); }
      orbAt(x, y, k, rr, t);
      if (amt > 1.05) { glow(x, y, rr * 6, EL_T[k], 0.35 * (amt - 1)); sparkle(x, y, rr * 1.6 * (amt - 1) + Math.sin(t * 13 + k) * 1.5, 22, ORB[k][2]); }
    }
  }
  // an ember: a dying orb, a mote of its colour with a faint halo; br 0..1
  function b4Ember(x, y, k, br, t) {
    if (br <= 0) return;
    glow(x, y, 4 + 10 * br, EL_T[k], 0.25 + 0.4 * br);
    P(x, y, ORB[k][br > 0.5 ? 2 : 1]); if (br > 0.4) { P(x + 1, y, ORB[k][1]); P(x, y + 1, ORB[k][1]); }
    if (br > 0.75) P(x, y, 22);
  }
  // FABLE INFINITE, complete: the light bent round it, rays, the four orbs blazing, three kinds of wings layered (nova flame
  // behind, storm lightning, prism in front), the white prism-banded body, a rainbow flame, and the halo.
  // o: ang, flip, sw (sword angle; null for none), swl (blade length in units, default a broken stub of 9), broken,
  // spread, flap, over (overdrive 0..1: the forms cycle, the wings multiply), cracks, eyes, mouth, white, after, sq, legs,
  // orbR, orbA (orb amount), warp, rays, auraR, wt (wing clock), noLife (still), bob
  function b4Inf(x, y, S, t, o) {
    o = o || {};
    const ang = o.ang || 0, sp_ = o.spread === undefined ? 1 : o.spread, ov = o.over || 0, f = fl(t * 30);
    if (o.warp) warp(x, y, 34 * S, o.warp * (0.8 + 0.2 * Math.sin(t * 7)), 1);
    if (o.rays) z5Sunburst(x, y, 16, t * 0.5, 6 * S, o.rays, 0.08 + 0.03 * ov);
    const orbR = o.orbR === undefined ? 20 * S : o.orbR, orbA = o.orbA === undefined ? 1.6 : o.orbA;
    // the four orbs ride a ring of prism light round it (the halo): the far half behind everything
    const orbr = Math.max(1.5, S * 1.6), oT = 0.3, ring = (front) => { if (orbR <= 0 || orbA < 1) return; for (let a = 0; a < TAU; a += 0.9 / orbR) { const z = Math.sin(a); if ((z > 0) !== front || (fl(a * orbR / 3) + f) % 3 === 0) continue; P(x + Math.cos(a) * orbR, y + z * orbR * oT, front ? PRISM[(fl(a * 4) + f) % 7] : 62); } };
    ring(false);
    if (orbR > 0) b4Orbs(x, y, orbR, t, orbr, oT, false, orbA, 2.6 + ov * 4);
    const wt = o.wt === undefined ? t : o.wt, bob = o.bob !== undefined ? o.bob : z5Bob(wt, S, o.flap) * sp_;
    const wx = x - Math.sin(ang) * 6 * S, wy = y + bob - Math.cos(ang) * 6 * S, ws = S * 0.6;
    if (ov > 0) for (let q = 0; q < Math.round(ov * 4); q++) b4Wings(wx, wy, ws * (1.5 - q * 0.08), wt * (1.3 + q * 0.2), sp_, (o.flap || 0.24) * 1.2, q % 2 ? 2 : 1, -0.9 + q * 0.5, 1.1);
    b4Wings(wx, wy, ws * 1.35, wt * 1.1 + 0.4, sp_, o.flap, 3, -0.38, 1.15);
    b4Wings(wx, wy, ws * 1.15, wt, sp_, o.flap, 2, 0.32, 1.0);
    b4Wings(wx, wy, ws, wt, sp_, o.flap, 0, 0, 1);
    let form = o.form || 'infinite';
    if (ov > 0.05) { const per = Math.max(1, Math.round(3 - ov * 2.5)); form = B4_FORMS[fl(f / per) % 6]; }
    const swl = o.swl === undefined ? 9 : o.swl;
    const heroO = { form, eyes: o.eyes || 'glow', mouth: o.mouth, sword: o.sw === undefined ? null : o.sw, fly: true, sq: o.sq, legs: o.legs, reach: o.reach, cracks: o.cracks };
    const opt = { white: o.white, after: o.after, bob, still: o.noLife, st: o.st, sd: o.sd };
    const r = heroO.sword === null ? Object.assign(actor(HERO3(heroO), x, y, S, ang, !!o.flip, Object.assign({ noSmear: true }, opt)), {}) : b4Hero(heroO, x, y, S, ang, !!o.flip, opt, swl, o.broken !== false, z5Sw(t));
    z5Eyes();
    const k0 = fl(t * 9) % 7;
    aura(t, [PRISM[k0], PRISM[(k0 + 2) % 7], 60, 22], o.auraR || 3.4 * S, { sparks: 14 + fl(ov * 20) });
    if (!o.white) z5Rim(0, 0, null, 0, 63);
    ring(true);
    if (orbR > 0) b4Orbs(x, y, orbR, t, orbr, oT, true, orbA, 2.6 + ov * 4);
    return r;
  }
  // the world under it all: the abyss below the chasm floor; slit (screen y) a crack of molten light far above
  function b4Abyss(t, gy, slitY, lightA, ox) {
    ox = ox || 0;
    gradient(LB, H - LB, [0, 0, 1, 96, 96, 97]);
    // the walls of the chasm climbing out of the frame either side, two depths of them: black rock in strata, faces turned
    // to the light far above catching a rim of it, seams of fire in the deep
    for (let layer = 0; layer < 2; layer++) {
      const par = 0.25 + layer * 0.45, base = layer ? 150 : 104, SH = layer ? 96 : 0, MID = layer ? 97 : 96, LIT = layer ? 98 : 97;
      for (let y = LB; y < gy + 14; y++) {
        const v = (y - LB) / Math.max(1, gy - LB);
        for (const sd of [-1, 1]) {
          const e0 = 240 + sd * (base - 26 * v + (vn(y * 0.045, layer * 2 + (sd > 0 ? 1 : 0), 1, 2115) - 0.5) * 60 + (vn(y * 0.22, layer + (sd > 0 ? 5 : 0), 1, 2116) - 0.5) * 10) - ox * par;
          const xa = sd < 0 ? 0 : Math.max(0, fl(e0)), xb = sd < 0 ? Math.min(W - 1, fl(e0)) : W - 1;
          for (let x = xa; x <= xb; x++) {
            const e = Math.abs(x - e0), st = frac((y + vn(x * 0.1, layer, 1, 2117) * 5) / (9 - layer * 3)) < 0.12;
            const n = vn(x * 0.07 + layer * 9, y * 0.045, 1, 2120 + layer) + (1 - Math.min(1, e / 60)) * 0.25 - v * 0.15;
            let c = e < 1.5 ? (lightA > 0.25 && bay(x, y) < 0.3 + lightA * 0.5 ? 101 : LIT) : n > 0.66 ? LIT : n > 0.44 ? MID : SH;
            if (st && c !== SH) c = c === LIT ? MID : SH;
            if (layer === 1 && v > 0.45 && Math.abs(vn(x * 0.06, y * 0.03, 1, 2118) - 0.5) < 0.007 && e < 30) c = 101;
            BUF[y * W + x] = c;
          }
        }
      }
    }
    if (slitY !== null) {
      glow(250, slitY, 120, T_EMBER, 0.18);
      for (let x = 150; x < 350; x++) { const w = (1 - Math.pow(Math.abs(x - 250) / 100, 2)) * 1.6, yy = slitY + (vn(x, 0, 9, 2111) - 0.5) * 6; for (let q = -fl(w) - 1; q <= w + 1; q++) P(x, yy + q, Math.abs(q) < w * 0.5 ? 105 : Math.abs(q) <= w ? 103 : 101); }
    }
    // a shaft of the far light falling down the chasm (dithered, drifting)
    const sx = 250 - ox * 0.2;
    for (let y = LB; y < gy; y++) { const v = (y - LB) / (gy - LB), hw = 18 + 50 * v, cx = sx + (vn(y * 0.02, t * 0.2, 1, 2119) - 0.5) * 20; for (let x = Math.max(0, fl(cx - hw)); x < Math.min(W, cx + hw); x++) { const f = 1 - Math.abs(x - cx) / hw; tintI(y * W + x, x, y, T_EMBER, f * f * 0.22 * (0.5 + lightA) * (1 - v * 0.4)); } }
    // dust and embers hanging in the dark at two depths, drifting up on the heat
    for (let k = 0; k < 40; k++) { const x = ((ih(k, 1, 2112) * 520 - ox * (0.3 + ih(k, 3, 2112)) + t * 3) % 520 + 520) % 520 - 20, y = LB + ih(k, 2, 2112) * (gy - LB) + Math.sin(t * 0.4 + k) * 3; P(x, y, k % 3 ? 97 : 98); }
    for (let k = 0; k < 18; k++) { const near = k % 3 === 0, f = frac(ih(k, 4, 2112) - t * (0.04 + ih(k, 5, 2112) * 0.05)), x = ((ih(k, 6, 2112) * 500 - ox * (near ? 1.2 : 0.5) + Math.sin(t * 0.7 + k) * 8) % 500 + 500) % 500 - 10, y = LB + f * (gy - LB + 20); if (near) { rectF(x, y, 2, 2, f < 0.5 ? 102 : 101); P(x, y, 104); } else P(x, y, f < 0.3 ? 103 : 101); }
    // the floor: broken rock, its lip lit faintly from above
    ridge(gy, 14, 40, 2113, 96, 98, ox);
    ridge(gy + 18, 10, 26, 2114, 96, 97, ox * 1.4);
    if (lightA > 0) glow(240, gy, 260, T_EMBER, 0.1 * lightA);
  }
  // the cracked crater the hero lies in
  function b4Crater(cx, cy, s, glowA, seed) {
    for (let k = 0; k < 9; k++) {
      let x = cx, y = cy; const a = (k / 9) * PI + PI * 0.06 + (ih(k, 1, seed) - 0.5) * 0.3, dir = Math.cos(a) > 0 ? 1 : -1;
      for (let q = 0; q < 6; q++) { const nx = x + dir * (6 + ih(k, q, seed + 1) * 10) * s, ny = y + (ih(k, q, seed + 2) - 0.5) * 3 * s + 0.6 * s; lineP(x, y, nx, ny, q < 2 && glowA > 0.3 ? 102 : 101); x = nx; y = ny; }
    }
  }
  const b4Clip = (a, b, t) => clamp((t - a) / (b - a), 0, 1);

  /* -------------------------------------------------------------- b4 hands, arms and life (the engine's anatomy) */
  // his stone and porcelain (what light squeezing out of a grip must not paint over)
  const b4IsHim = (c) => (c >= 64 && c <= 69) || (c >= 96 && c <= 100);
  // a hand pose between two poses (names or objects), u 0..1
  function b4Pose(a, b, u) {
    const A = poseOf(a), B = poseOf(b), ca = A.curls || [0, 1, 2, 3].map(() => A.curl), cb = B.curls || [0, 1, 2, 3].map(() => B.curl);
    u = clamp(u, 0, 1);
    return { curls: ca.map((c, i) => lerp(c, cb[i], u)), thumb: lerp(A.thumb, B.thumb, u), spread: lerp(A.spread, B.spread, u) };
  }
  // the fingers of a hand sunderer() drew with layer 'palm' (so something can sit in the palm first): the hand's place,
  // angle and scale are read back from the point it returned
  function b4Fing(h, pose, heat, side) {
    const ax = h.knuckles[0] - h.palm[0], ay = h.knuckles[1] - h.palm[1], d = Math.hypot(ax, ay) || 1, s = d / 5.3;
    return sHand(h.palm[0] - ax / d * 5.5 * s, h.palm[1] - ay / d * 5.5 * s, s, Math.atan2(ay, ax), Object.assign({}, poseOf(pose), { heat: heat || 0, side, layer: 'fingers' }), 0);
  }
  // light squeezed out of a grip: rays from (cx, cy) that show only where his hand is not (so they come out between the
  // fingers), and the porcelain round it lit through like a lamp; amt 0..1
  function b4Leak(cx, cy, r0, len, n, t, amt, seed, cols) {
    if (amt <= 0.02) return;
    cols = cols || [22, 16];
    for (let k = 0; k < n; k++) {
      const a = (k + ih(k, 1, seed) * 0.8) / n * TAU + Math.sin(t * 2.3 + k) * 0.06, L = len * (0.45 + 0.55 * ih(k, fl(t * 10), seed + 1)) * amt, ca = Math.cos(a), sa = Math.sin(a), w = 1.2 + ih(k, 2, seed) * 2.2;
      for (let r = r0 * 0.6; r < r0 + L; r += 0.8) {
        const fade = r < r0 ? 1 : 1 - (r - r0) / L, ww = w * (0.6 + 0.4 * fade);
        for (let q = -ww; q <= ww; q += 0.7) {
          const x = fl(cx + ca * r - sa * q), y = fl(cy + sa * r + ca * q); if (x < 0 || x >= W || y < LB || y >= H - LB) continue;
          const i = y * W + x; if (b4IsHim(BUF[i])) continue;
          if (bay(x, y) < fade * (1.1 - Math.abs(q) / (ww + 0.6))) BUF[i] = Math.abs(q) < ww * 0.45 && fade > 0.45 ? cols[0] : cols[1];
        }
      }
    }
    // the porcelain lit through, hottest nearest the light
    const R = r0 * 2.6;
    for (let y = Math.max(LB, fl(cy - R)); y < Math.min(H - LB, cy + R); y++) for (let x = Math.max(0, fl(cx - R)); x < Math.min(W, cx + R); x++) {
      const i = y * W + x, c = BUF[i]; if (!b4IsHim(c)) continue;
      const d = Math.hypot(x - cx, y - cy) / R; if (d < 1) tintI(i, x, y, T_WARM, amt * 0.75 * (1 - d));
    }
  }
  // where sunderer() bends an elbow, for arms drawn apart from him (severed ones)
  function b4Elbow(ax, ay, wx, wy, s, k) {
    const sd = SH4[k][0] < 0 ? -1 : 1, up = k < 2, mx = (ax + wx) / 2, my = (ay + wy) / 2, dx = wx - ax, dy = wy - ay, L = Math.hypot(dx, dy) || 1, bend = Math.max(0, 152 * s - L) * 0.45;
    return [mx + (-dy / L) * bend * -sd * (up ? 1 : 0.8), my + (dx / L) * bend * -sd * (up ? 1 : 0.8) + bend * 0.3 + 3 * s];
  }
  /* an arm of his, drawn the engine's way (muscled obsidian upper arm with veins, an elbow cop, a vambrace of three porcelain
     plates with fire in the gaps, the jointed hand), for arms that are no longer attached to him: shoulder (ax, ay) — the
     cut end, burning — elbow (ex, ey), wrist (wx, wy) or null (a stump cut at the elbow, burning there too) */
  function b4ArmLook(ax, ay, ex, ey, wx, wy, s, heat, k, pose, ang, t) {
    const rU = (u) => s * (17 + 5 * Math.sin(PI * Math.min(1, u * 1.25)) - u * 4);
    limbF(ax, ay, ex, ey, rU, 22 * s, (u, sdn, lit, X, Y, e) => {
      if (u < 0.05) return e < 0.45 ? 22 : e < 0.75 ? 105 : 103;
      const vein = Math.abs(sdn - 0.35 * Math.sin(u * 9 + k)) < 0.06 && u > 0.12 && u < 0.86; return vein && heat > 0.25 ? (heat > 0.6 ? 104 : 103) : obsLit(lit, X, Y, e, heat);
    });
    if (wx === null) { discF(ex, ey, 12 * s, 101); discF(ex, ey, 9 * s, 103); discF(ex, ey, 5.5 * s, 105); discF(ex, ey, 2.5 * s, 22); return null; }
    limbF(ex, ey, wx, wy, (u) => s * (12.5 + u * 2.5), 16 * s, (u, sdn, lit, X, Y, e) => {
      if (u < 0.28) return obsLit(lit, X, Y, e, heat);
      const pf = (u - 0.28) / 0.72 * 3; if (frac(pf) < 0.07 && u < 0.98) return heat > 0.25 ? (heat > 0.6 ? 104 : 102) : 96;
      if (e > 0.9) return 69;
      if (Math.abs(sdn + 0.15) < 0.05 && frac(pf) > 0.25 && frac(pf) < 0.8) return 67;
      return BONE4[clamp(fl(2.6 + lit * 2.4 + (bay(X, Y) - 0.5) * 0.9 - (frac(pf) < 0.18 ? 0.8 : 0)), 0, 5)];
    });
    discF(ex, ey, 11 * s, heat > 0.3 ? 102 : 96); limbF(ex - 1, ey - 1, ex + 1, ey + 1, () => 9.5 * s, 10 * s, (u, sdn, lit, X, Y, e) => e > 0.86 ? 69 : BONE4[clamp(fl(2.4 + lit * 2.4 + (bay(X, Y) - 0.5) * 0.9), 0, 5)]);
    discF(wx, wy, 13 * s, heat > 0.3 ? 103 : 96);
    const sd = SH4[k][0] < 0 ? -1 : 1;
    return sHand(wx, wy, s, ang === undefined ? Math.atan2(wy - ey, wx - ex) : ang, Object.assign({}, poseOf(pose || 'open'), { heat, side: k < 2 ? sd : -sd }), t);
  }
  // an arm between blows is never still: the wrist drifts on a slow loop and the fingers flex (k: which arm)
  const b4Idle = (t, k, amp) => [z5N(t * 0.55, k * 3.1) * (amp || 6), z5N(t * 0.47, k * 1.7 + 9) * (amp || 6) * 0.8];
  const b4Flex = (t, k, base) => { const P_ = poseOf(base || 'fist'), cs = P_.curls || [0, 1, 2, 3].map(() => P_.curl); return { curls: cs.map((c, i) => clamp(c + 0.07 * Math.sin(t * 1.3 + k * 2 + i * 0.9), 0, 1)), thumb: P_.thumb, spread: clamp(P_.spread + 0.08 * Math.sin(t * 0.9 + k), 0, 1) }; };
  // keep a reach inside what the arm can do (local units from shoulder k): a straight arm is a tube, a bent one an arm
  function b4Reach(k, x, y, max) { const dx = x - SH4[k][0], dy = y - SH4[k][1], d = Math.hypot(dx, dy), m = max || 140; return d <= m ? [x, y] : [SH4[k][0] + dx / d * m, SH4[k][1] + dy / d * m]; }

  /* ================================================================ V.1 — rock bottom (104.0–107.4) */
  // the four embers fall and land on it at these times (absolute), one piano note each
  const B4_LAND = [105.2, 105.8, 106.4, 107.0];
  const B4_EMB_X = [212, 268, 230, 252];
  function b4EmberPath(k, t, HX, HY) {
    const land = B4_LAND[k], st = land - 2.2, u = clamp((t - st) / 2.2, 0, 1), e = 1 - Math.pow(1 - u, 1.6);
    const x0 = B4_EMB_X[k], y0 = 30;
    const x = lerp(x0, HX + (k - 1.5) * 5, e) + Math.sin(u * 7 + k * 2) * 14 * (1 - u), y = lerp(y0, HY - 2 + (k % 2) * 3, e);
    return [x, y, u];
  }
  shot(104.0, 107.4, (lt, t) => {
    const GY = 206, HX = 244, HY = 194;
    b4Abyss(t, GY, 34, 0.5, 0);
    b4Crater(HX, GY + 1, 1.6, 0.2, 2121);
    // the hero, face down in the dark: flattened, limp, cracked, the light almost out; each ember that lands lifts it a
    // fraction (a pulse in its cracks)
    let pulse = 0; for (const L of B4_LAND) { const g = t - L; if (g > 0) pulse = Math.max(pulse, Math.exp(-g * 4)); }
    const breath = Math.sin(t * 1.1) * 0.03;
    b4Hero({ eyes: 'closed', sword: 0.18, cracks: 0.9, sq: 0.32 + breath, legs: [3, 4, 3, 4] }, HX, HY, 2.2, 0.1, false, { still: true }, 8, true);
    b4TintSprite(T_DARK, 0.55 - pulse * 0.4);
    glow(HX, HY, 18 + pulse * 14, T_EMBER, 0.12 + pulse * 0.3);
    // the embers: falling, swaying; once landed they sit on it, faint
    for (let k = 0; k < 4; k++) {
      const [x, y, u] = b4EmberPath(k, t, HX, HY);
      if (u <= 0) continue;
      const g = t - B4_LAND[k];
      if (g > 0) { b4Ember(HX + (k - 1.5) * 5, HY - 2 + (k % 2) * 3, k, 0.35 + 0.15 * Math.sin(t * 3 + k), t); if (g < 0.5) { sparkle(HX + (k - 1.5) * 5, HY - 2, 5 * (1 - g / 0.5), 22, ORB[k][2]); glow(HX, HY, 30, EL_T[k], 0.4 * (1 - g / 0.5)); } }
      else { b4Ember(x, y, k, 0.55 + 0.2 * Math.sin(t * 5 + k), t); for (let q = 1; q < 6; q++) { const [px, py] = b4EmberPath(k, t - q * 0.05, HX, HY); if (bay(fl(px), fl(py)) < 0.5 - q * 0.08) P(px, py, ORB[k][1]); } }
    }
    // the camera sinks slowly toward it
    const z = 1.1 + 0.5 * eio(lt / 3.4);
    z5Cam(z, 0.004 * z5N(t * 0.4, 1), lerp(240, HX, eio(lt / 3.4)), lerp(150, HY - 14, eio(lt / 3.4)), 240, 140);
    fadeIn(lt, 0.5);
  });

  /* ================================================================ V.2 — one more time (107.4–110.5) */
  shot(107.4, 110.5, (lt, t) => {
    const GY = 236, S = 5.0;
    b4Abyss(t, GY, null, 0.4, 30);
    glow(250, 30, 200, T_EMBER, 0.12);
    // it gathers itself: the eye opens a slit (108.2), the hand closes on the hilt (108.7), it pushes itself up (109.4),
    // its arms give and it drops back (109.85), and it tries again and gets up onto its knees (110.05 →)
    const eye = t < 108.2 ? 'closed' : t < 108.32 ? 'narrow' : t < 108.4 ? 'closed' : t < 109.85 ? 'narrow' : t < 110.05 ? 'closed' : 'wide';
    const grip = z5Knock(t - 108.7, 1, 18, 7);
    const up1 = eio(b4Clip(109.4, 109.82, t)), drop = eic(b4Clip(109.82, 109.95, t)), up2 = eoc(b4Clip(110.05, 110.5, t));
    const lift = up1 * (1 - drop) + up2 * 0.85, land = z5Knock(t - 109.95, 1, 16, 6);
    const effort = t > 108.6 ? (0.4 + (t > 109.4 ? 1 : 0)) : 0, tr = effort * z5Sh(t, 3);
    const HX = 236 + tr * 1.4, HY = 196 - lift * 22 + land * 4 + tr * 0.6;
    const ang = lerp(0.16, -0.02, lift) + tr * 0.012 + land * 0.04;
    // floor and crater under it
    b4Crater(HX, GY - 2, 3.2, 0.3, 2131);
    let pulse = 0; for (const L of [108.0, 108.7, 109.0, 109.5, 110.05]) { const g = t - L; if (g > 0) pulse = Math.max(pulse, Math.exp(-g * 3.5) * 0.8); }
    const sq = lerp(0.3, 0.02, lift) + land * 0.12, legs = [lerp(4, 0.5, lift), lerp(3, 1, lift), lerp(4, 0.5, lift), lerp(3, 1, lift)];
    const r = b4Hero({ eyes: eye, mouth: t > 109.0 && t < 110.3 && fl(t * 7) % 2 ? 1 : t > 110.1 ? 2 : 0, sword: 0.3 - grip * 0.25 - lift * 0.5, cracks: 0.9, sq, legs }, HX, HY, S, ang, false, { still: true }, 8, true);
    b4TintSprite(T_DARK, 0.26 - pulse * 0.2);
    // the four embers sit in its cracks and beat with it
    for (let k = 0; k < 4; k++) { const ex = HX - 34 + k * 22 + tr, ey = HY - 8 + (k % 2) * 14; b4Ember(ex, ey, k, 0.55 + pulse * 0.45 + 0.1 * Math.sin(t * 2.4 + k), t); discF(ex, ey, 1.4, ORB[k][2]); }
    // the broken hilt catches a glint
    if (t > 108.7 && t < 109.1) sparkle(r.tip[0], r.tip[1], 6 * (1 - (t - 108.7) / 0.4), 22, 34);
    glow(HX, HY, 70, T_EMBER, 0.08 + pulse * 0.14);
    // grit sliding off it as it moves; dust where it drops
    if (lift > 0.05) for (let k = 0; k < 8; k++) { const g = frac(t * 1.5 + ih(k, 1, 2132)); P(HX - 50 + ih(k, 2, 2132) * 100, HY + 30 + g * 40, 98); }
    if (t > 109.95) debris(HX, GY - 6, t - 109.95, 12, 40, 0.6, [97, 98, 99], 2133, 80);
    shk(t > 109.95 && t < 110.2 ? 2 : 0);
    z5Cam(1.06 + 0.08 * eio(lt / 3.1), 0.01 * z5N(t * 0.5, 2), 236, 172 - lift * 10, 240, 150);
  });
  CAPS.push([109.0, 110.5, 's', 'HERO', 'ONE... MORE... TIME.']);

  /* ================================================================ V.3 — every form at once (110.5–113.0) */
  // the forms run through it: gold, storm, zenith, nova, last light, then all of them, faster and faster
  const B4_CASC = [[110.5, 'gold'], [111.05, 'storm'], [111.5, 'zenith'], [111.85, 'nova'], [112.15, 'lastlight']];
  function b4CascForm(t) {
    if (t >= 112.4) { const per = t < 112.7 ? 3 : t < 112.88 ? 2 : 1, f = fl(t * 30); return ['gold', 'storm', 'zenith', 'nova', 'lastlight', 'infinite'][fl(f / per) % 6]; }
    let F = 'gold'; for (const [a, n] of B4_CASC) if (t >= a) F = n; return F;
  }
  shot(110.5, 113.0, (lt, t) => {
    const GY = 214, rise = eio(b4Clip(110.5, 112.9, t)), shakeA = 0.4 + lt * 1.2;
    const HX = 240 + z5Sh(t, 1) * shakeA * 0.6, HY = lerp(178, 140, rise) + z5Sh(t, 2) * shakeA * 0.5, S = 3.4;
    b4Abyss(t, GY, null, 0.3 + lt * 0.3, 0);
    // the light it gives off reaches the walls, and rocks lift off the floor around it
    const F = b4CascForm(t);
    const has = (n) => B4_CASC.some(([a, m]) => m === n && t >= a);
    glow(HX, HY, 80 + lt * 40, F === 'storm' ? T_CYAN : F === 'zenith' ? T_WH : F === 'nova' ? T_NOVA : F === 'lastlight' ? T_FIRE : T_GOLD, 0.25 + lt * 0.08);
    for (let k = 0; k < 24; k++) { const g = lt - ih(k, 1, 2141) * 1.6; if (g < 0) continue; const x = 60 + ih(k, 2, 2141) * 360, y = GY + 4 - g * g * (14 + ih(k, 3, 2141) * 20) - g * 8, s = 1 + fl(ih(k, 4, 2141) * 4); if (y < LB) continue; rectF(x + Math.sin(g * 2 + k) * 2, y, s, s, k % 3 ? 97 : 99); if (s > 2) P(x, y, 101); }
    // a ring of light running out along the floor each time the form changes
    for (const [a] of B4_CASC) { const g = t - a; if (g > 0 && g < 0.6) shockRing(HX, GY, 10 + g * 380, 2 + g * 30, 2, [22, 59, 58], 1 - g / 0.6); }
    // the layers: what each form leaves behind stays on, under the next
    const wt = t * 1.4;
    if (has('nova')) b4Wings(HX, HY - 6 * S, S * 0.75, wt + 0.3, Math.min(1, (t - 111.85) * 4), 0.2, 1, -0.2, 1.1);
    if (has('storm')) { for (let k = 0; k < 3; k++) { const f = fl(t * 15), a0 = ih(k, f, 2142) * TAU; bolt(HX + Math.cos(a0) * 8 * S, HY + Math.sin(a0) * 8 * S, HX + Math.cos(a0 + 0.6) * 20 * S, HY + Math.sin(a0 + 0.6) * 20 * S, f + k, 1, 91, 89); } }
    if (has('zenith')) z5Wings(HX, HY - 6 * S, S * 0.6, wt, Math.min(1, (t - 111.5) * 3), 0.22);
    const form = F === 'gold' ? undefined : F;
    b4Hero({ form, eyes: t < 111.05 ? 'angry' : 'glow', mouth: t > 112.4 ? 2 : 0, sword: -0.9 * rise - 0.1, cracks: F === 'lastlight' ? 0.85 : 0.9 - rise * 0.4, sq: 0.1 - rise * 0.15, legs: [2 * (1 - rise), 2 * (1 - rise), 2 * (1 - rise), 2 * (1 - rise)] }, HX, HY, S, 0, false, {}, 9, true, F === 'gold' ? GOLD_SW : F === 'storm' ? STORM_SW : z5Sw(t));
    if (F === 'zenith' || F === 'infinite') z5Eyes();
    const AU = { gold: AURA_GOLD, storm: AURA_STORM, zenith: ZEN_FLAME, nova: [104, 105, 109, 108], lastlight: [101, 103, 104, 107], infinite: [PRISM[fl(t * 9) % 7], PRISM[(fl(t * 9) + 2) % 7], 60, 22] }[F];
    aura(t, AU, (2.4 + lt * 1.4) * S * 0.9, { sparks: 10 + fl(lt * 8) });
    if (has('gold') && F !== 'gold') aura(t + 0.5, AURA_GOLD, 1.4 * S, { sparks: 0 });
    z5Rim(0, 0, null, 0, 63);
    // the embers wake: they start to circle it again, brighter with each form
    for (let k = 0; k < 4; k++) { const a = t * (1.5 + lt * 1.5) + k * TAU / 4, R = 22 * S - lt * 10, z = Math.sin(a); b4Ember(HX + Math.cos(a) * R, HY + z * R * 0.3, k, 0.4 + lt * 0.25, t); }
    shk(0.5 + lt * 1.4);
    const z = 1.0 + 0.3 * eic(lt / 2.5);
    z5Cam(z, 0.006 * z5N(t, 3), HX, HY + 6, 240, 140);
  });

  /* ================================================================ V.4 — FABLE INFINITE (113.0–114.6) */
  shot(113.0, 114.6, (lt, t) => {
    const GY = 222, HX = 240, HY = 132 - z5Knock(lt, 8, 7, 3);
    b4Abyss(t, GY, null, 1, 0);
    // everything round it is lit and blown outward: rock flung from the floor, a ring of light racing out
    z5GodRays(HX, HY, 9, t * 0.4, T_WH, 0.55 * (1 - lt * 0.35), 400);
    rocks(HX, GY, lt, 22, 300, 4, [96, 98, 99, 103], 2151, 60, -PI / 2, 2.4);
    shockRing(HX, HY, 20 + lt * 600, 20 + lt * 600, 4, [22, 85, 83], 1 - lt / 0.9);
    shockRing(HX, GY, 10 + lt * 700, 3 + lt * 60, 4, [22, 60, 59], 1 - lt / 1.2);
    b4Inf(HX, HY, 3.5, t, { sw: -1.15, spread: 1, flap: 0.3, wt: t * 1.6, orbR: 84, orbA: 2, warp: 0.5, rays: 150 + lt * 60, auraR: 12, mouth: lt < 0.8 ? 2 : 0 });
    if (lt < 0.03) impactFrame(HX, HY, 1);
    shk(9 * Math.exp(-lt * 3));
    const [kz, kr] = kick(lt, [[0, 3]]);
    z5Cam(1.12 - 0.12 * eoc(lt / 1.6) + kz, kr, HX, HY + 14, 240, 140);
  });
  CAPS.push([113.0, 114.5, 'x', '', 'FABLE...', 50], [113.35, 114.5, 'x', '', 'INFINITE!', 216]);

  /* ================================================================ V.5 — the ascent (114.6–118.0) */
  // one continuous rise: up the chasm, out past the sea, through the cloud sea, into the morning above
  const B4_SEA = 1300, B4_CB = 2500, B4_CT = 3200, B4_TOP = 3900, B4_AD = 3.4;
  const b4AV = (u) => (u < 0.1 ? u / 0.1 : u < 0.82 ? 1 : 1 - 0.88 * eio((u - 0.82) / 0.18));
  let B4_AN = 0; for (let k = 0; k < 400; k++) B4_AN += b4AV((k + 0.5) / 400) / 400;
  function b4AscY(lt) { const u = clamp(lt / B4_AD, 0, 1), n = 120; let s = 0; for (let k = 0; k < n; k++) s += b4AV((k + 0.5) / n * u) * u / n; return B4_TOP * s / B4_AN; }
  // the sky of the morning above the clouds, the sun in it
  const B4_SKY = [3, 4, 5, 6, 7, 8, 19, 15, 16];
  function b4Sky(t, hz, sunX, sunY, sunR, sunA) {
    gradient(LB, hz, B4_SKY);
    if (sunA > 0 && sunR > 0) { glow(sunX, sunY, sunR * 7, T_WARM, 0.55 * sunA); discF(sunX, sunY, sunR * 1.25, 15); discF(sunX, sunY, sunR, 16); discF(sunX - sunR * 0.2, sunY - sunR * 0.2, sunR * 0.45, 22); }
  }
  // the Sunderer as he stands in act V: lower arms gone, the mask cut, his brother's eye open in his brow
  const B4_MCUT = [[-12, -18, 10, 20, 1]];
  const B4_LOW = [{ x: -118, y: 150, cut: true }, { x: 118, y: 150, cut: true }];
  function b4Sund(cx, cy, s, t, o) {
    const arms = o.arms || [0, 1].map((k) => { const [dx, dy] = b4Idle(t, k); return { x: (k ? 132 : -132) + dx, y: 110 + dy, pose: b4Flex(t, k, 'fist') }; });
    // arms marked drift breathe between blows: the wrist on a slow loop, the fingers flexing
    const live = (A, k) => !A || !A.drift ? A : Object.assign({}, A, { x: A.x + b4Idle(t, k, A.drift)[0], y: A.y + b4Idle(t, k, A.drift)[1], pose: typeof A.pose === 'string' ? b4Flex(t, k, A.pose) : A.pose });
    return sunderer(cx, cy, s, t, Object.assign({ heat: 0.85, rage: 0.8, third: 1, eyes: 1.2, crown: 1, maskCuts: B4_MCUT }, o, { arms: [live(arms[0], 0), live(arms[1], 1), o.low === false ? null : B4_LOW[0], o.low === false ? null : B4_LOW[1]] }));
  }
  function b4Ascent(lt, t, Yc, vel) {
    const top = LB, bot = H - LB, SY = 135;
    // the far layer: the chasm's far wall (below the sea) or the sea and its sky; the cloud ceiling seen from below
    const hz = SY - 0.35 * (B4_SEA - Yc);
    if (Yc < B4_CT) belowWorld(t, clamp(hz, LB - 2, H), 0, 0.4, SKY_BLOOD);
    for (let y = top; y < bot; y++) {
      const Yf = Yc * 0.35 + (SY - y), Yceil = Yc * 0.15 + (SY - y);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        // the cloud ceiling, coming down out of the top as it nears
        if (Yc > 1500 && Yc < B4_CT && Yceil > B4_CB * 0.15 + (vn(x, 0, 40, 2211) - 0.5) * 30 + (vn(x, 0, 11, 2210) - 0.5) * 10) { const d = Yceil - B4_CB * 0.15; BUF[i] = d < 3 ? 19 : d < 14 ? (bay(x, y) < 0.5 ? 18 : 17) : 17; continue; }
        // the far wall of the chasm, while it is still in it: dark, with a red glow from the depths
        if (Yc < B4_SEA + 60 && Yf < B4_SEA * 0.35 && y > hz) { const n = vn(x * 0.25, Yf * 0.25, 3, 2212); BUF[i] = Math.abs(n - 0.5) < 0.02 ? 101 : n > 0.62 ? 1 : 96; continue; }
      }
    }
    if (Yc < B4_SEA) glow(240, bot, 260, T_EMBER, 0.2 * (1 - Yc / B4_SEA));
    // the chasm seen from above once it is clear: a burning gash in the sea, narrowing to the horizon
    if (Yc > B4_SEA - 60 && hz < bot) for (let y = Math.max(top, fl(hz)); y < bot; y++) { const w = (y - hz) * 0.5 + 1; for (let x = fl(240 - w); x <= 240 + w; x++) { const e = Math.abs(x - 240) / w; P(x, y, e < 0.3 ? 105 : e < 0.7 ? 103 : 101); } }
    // above the clouds: the morning sky and the top of the cloud sea far below
    if (Yc > B4_CB) {
      const hz2 = 168 + (Yc - B4_CT) * 0.09;
      Z5B.set(BUF);
      b4Sky(t, hz2, 300, 52 + (B4_TOP - Yc) * 0.06, 14, 1);
      cloudBank(hz2 + 4, 22, 80, 5051, t * 12, CLOUD_SUN, false);
      cloudBank(hz2 + 30, 30, 60, 5052, t * 18, [17, 18, 19, 15], false);
      // the Sunderer, waiting: a mountain rising out of the cloud sea
      const sy = 92 + (B4_TOP - Yc) * 0.3;
      if (sy < bot + 40) { b4Sund(396, sy, 1.25, t, { eyes: 1.4, tilt: -0.08, nod: 2, arms: [{ x: -132, y: 120, pose: 'fist', drift: 6 }, { x: 130, y: 100, pose: 'claw', drift: 8 }] }); cloudBank(hz2 + 40, 24, 50, 5053, t * 22, [17, 18, 19, 15], false); }
      // until it is clear of the clouds, the old picture shows below the cloud's top
      if (Yc < B4_CT + 200) for (let y = top; y < bot; y++) { const Yn = Yc + (SY - y); if (Yn < B4_CT) for (let x = 0; x < W; x++) BUF[y * W + x] = Z5B[y * W + x]; }
    }
    // the near layer: the chasm walls, rushing past; the sea pouring over their lips; spires
    for (let y = top; y < bot; y++) {
      const Yn = Yc + (SY - y);
      if (Yn >= 0 && Yn < B4_SEA) {
        const xl = 96 + (vn(Yn * 0.012, 0, 1, 2213) - 0.5) * 80 + (vn(Yn * 0.08, 0, 1, 2214) - 0.5) * 18, xr = 384 + (vn(Yn * 0.012, 3, 1, 2215) - 0.5) * 80 + (vn(Yn * 0.08, 3, 1, 2216) - 0.5) * 18;
        const lipF = B4_SEA - Yn < 160 ? 1 - (B4_SEA - Yn) / 160 : 0;
        for (let x = 0; x < W; x++) {
          const inL = x < xl, inR = x > xr; if (!inL && !inR) continue;
          const e = inL ? xl - x : x - xr, n = vn(x * 0.12, Yn * 0.03, 2, 2217);
          let c = e < 2 ? 123 : e < 5 ? 100 : e < 10 ? 99 : n > 0.6 ? 98 : 97;
          if (Math.abs(vn(x * 0.05, Yn * 0.02, 1, 2218) - 0.5) < 0.02) c = e < 30 ? 105 : 103;
          // the sea falls in over the lip in sheets
          if (lipF > 0 && e < 26 * lipF + 4 && ih(x, fl(Yn / 3 + t * 40), 2219) < 0.5 + lipF * 0.4) c = e < 6 ? 119 : bay(x, y) < 0.5 ? 118 : 117;
          BUF[y * W + x] = c;
        }
      }
      // two spires standing out of the sea
      for (const [sx, sh_, sw_] of [[46, 900, 40], [446, 650, 34]]) if (Yn > B4_SEA && Yn < B4_SEA + sh_) { const v = (Yn - B4_SEA) / sh_, half = sw_ * (0.25 + 0.75 * Math.pow(1 - v, 0.6)); for (let x = fl(sx - half); x <= sx + half; x++) P(x, y, (x - sx) / half < -0.4 ? 99 : 97); }
      // the body of the cloud sea: mist, darker below, lit toward its top
      if (Yn > B4_CB && Yn < B4_CT) { const d = (Yn - B4_CB) / (B4_CT - B4_CB); for (let x = 0; x < W; x++) { const v = d * 3 + vn(x * 0.04, Yn * 0.01, 1, 2225) * 0.8 - 0.4 + bay(x, y) * 0.5; BUF[y * W + x] = v < 0.6 ? 17 : v < 1.4 ? 18 : v < 2.3 ? 19 : 20; } }
    }
    // the cloud: banks of it rushing down past, near ones faster
    if (Yc > B4_CB - 400 && Yc < B4_CT + 500) for (let k = 0; k < 34; k++) {
      const par = 1 + ih(k, 4, 2226) * 0.6, Y = B4_CB - 40 + ih(k, 1, 2226) * (B4_CT - B4_CB + 80), y = SY - (Y - Yc) * par;
      if (y < -60 || y > H + 60) continue;
      let x = ih(k, 2, 2226) * W; if (Math.abs(x - 240) < 70) x += x < 240 ? -70 : 70;
      const d = (Y - B4_CB) / (B4_CT - B4_CB);
      cloudPuff(x, y, 22 + ih(k, 3, 2226) * 30, d < 0.4 ? [17, 18, 19, 20] : [18, 19, 20, 21], 2227 + k);
    }
  }
  shot(114.6, 118.0, (lt, t) => {
    const Yc = b4AscY(lt), Yp = b4AscY(lt - 1 / 30), vel = (Yc - Yp) * 30, u = lt / B4_AD, vn_ = b4AV(u);
    b4Ascent(lt, t, Yc, vel);
    // speed: the world smeared along the rise, streaks rushing down past it
    const sc = Yc < B4_SEA ? 101 : Yc < B4_CB ? 118 : 21;
    streaks(PI / 2, 30, t, vel * 1.4, sc, 30 + vel * 0.06, 2231);
    streaks(PI / 2, 10, t + 0.3, vel * 1.9, Yc < B4_SEA ? 105 : 22, 50 + vel * 0.08, 2235);
    // crossing the sea's lip, and the cloud's base and top: the medium bursts round it
    const HX = 240 + z5N(t * 1.3, 1) * 6 - 70 * eio(b4Clip(0.8, 1, u)), HY = 184 - 44 * vn_ + 14 * eio(b4Clip(0.85, 1, u));
    const tSea = b4TOf(B4_SEA - 40), tCB = b4TOf(B4_CB - 40), tCT = b4TOf(B4_CT - 40);
    const gs = lt - tSea; if (gs > 0 && gs < 0.8) { rocks(HX, HY + 40, gs, 26, 260, 3, [117, 118, 119, 22], 2232, 300, -PI / 2, 3.2); shockRing(HX, HY + 30, 10 + gs * 500, 3 + gs * 90, 3, [22, 119, 118], 1 - gs / 0.6); }
    const gc = lt - tCB; if (gc > 0 && gc < 0.5) shockRing(HX, HY - 20, 10 + gc * 600, 4 + gc * 120, 4, [22, 21, 20], 1 - gc / 0.5);
    const gt = lt - tCT; if (gt > 0 && gt < 1.2) { for (let k = 0; k < 9; k++) cloudPuff(HX + (ih(k, 1, 2233) - 0.5) * 160 * (0.4 + gt), HY + 60 - gt * (90 + ih(k, 2, 2233) * 120) + gt * gt * 140, 10 + ih(k, 3, 2233) * 10, [18, 19, 20, 21], 2234 + k); shockRing(HX, HY + 30, 10 + gt * 520, 3 + gt * 60, 4, [22, 21, 16], 1 - gt / 0.7); }
    // the hero: wings swept back for the climb, blade-stub up, afterimages streaming below it
    const after = []; for (let k = 1; k <= 4; k++) after.push([HX, HY + k * vel * 0.012, k === 1 ? 22 : PRISM[(k * 2 + fl(t * 30)) % 7], 0.6 - k * 0.12]);
    const climb = 1 - eio(b4Clip(0.86, 1, u));
    b4Inf(HX, HY, 2.6, t, { sw: lerp(-0.6, -1.5, climb), ang: -0.12 * climb, spread: lerp(1, 0.45, climb), flap: 0.3, wt: t * 3.5, orbR: 52 - 16 * climb, after: vel > 300 ? after : undefined, warp: 0.35, auraR: 8 + 6 * climb, noLife: true, st: 0.35 * climb * Math.min(1, vel / 900), sd: -PI / 2, sq: -0.15 * climb });
    shk(1 + vel / 500);
    z5Cam(1.02 + 0.03 * vn_, 0.02 * z5N(t * 1.7, 2) * vn_, 240, 135, 240, 135);
    if (lt < 0.1) glow(HX, HY, 120, T_WH, 0.5 * (1 - lt / 0.1));
  });
  // when the rise passes altitude Y (shot time)
  function b4TOf(Y) { let a = 0, b = B4_AD; for (let k = 0; k < 24; k++) { const m = (a + b) / 2; if (b4AscY(m) < Y) a = m; else b = m; } return a; }

  /* ================================================================ V.6 — THE WORLDBLADE (118.0–121.5) */
  // the hilt grows a blade, and it does not stop: the camera pulls back from the hero, to the clouds, to the curve of the
  // world, and the blade is longer than the world is wide
  const B4_RW = 25000, B4_ZE = 150 / B4_RW;
  const b4WBZ = (lt) => Math.exp(Math.log(B4_ZE) * eio(b4Clip(0.55, 3.5, lt)));
  // the world from afar: a disc of cloud lit by the sun, an atmosphere on its rim; (px, py) its top, Rs its radius
  function b4Planet(px, py, Rs, t, sunX, sunY, dark) {
    const cx = px, cy = py + Rs, K = Math.min(B4_RW / 60, Rs / 4), lx = sunX - cx, ly = sunY - cy, ll = Math.hypot(lx, ly, Rs * 1.2) || 1;
    const atm = Math.max(2, Math.min(10, 3 + 2000 / Rs));
    const y0 = Math.max(LB, fl(py - atm - 1));
    for (let y = y0; y < H - LB; y++) {
      const dy = y + 0.5 - cy;
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - cx, d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
        if (d > Rs + atm) continue;
        const i = y * W + x;
        if (d > Rs) { if (bay(x, y) < 1 - (d - Rs) / atm) BUF[i] = (d - Rs) < atm * 0.35 ? 90 : 89; continue; }
        const u = dx / Rs, v = dy / Rs, z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
        const n = vn(u * K + t * 0.6, z * K * 1.6, 1, 2301) * 0.65 + vn(u * K * 3 + t * 1.5, z * K * 4, 1, 2302) * 0.35;
        const lit = (u * lx + v * ly + z * Rs * 1.2) / ll, rim = 1 - z;
        let l = lit * 1.1 + (n - 0.5) * 0.9 + (bay(x, y) - 0.5) * 0.35 - (dark || 0);
        let c = l < 0.05 ? 3 : l < 0.3 ? 17 : l < 0.55 ? 18 : l < 0.8 ? 19 : l < 1.0 ? 15 : 16;
        if (rim > 0.93 && bay(x, y) < (rim - 0.93) * 12) c = 20;
        BUF[i] = c;
      }
    }
  }
  shot(118.0, 121.5, (lt, t) => {
    const Z = b4WBZ(lt), pull = eio(b4Clip(0.55, 3.5, lt));
    const AX = lerp(170, 110, pull), AY = lerp(150, 148, pull);
    const space = sstep(-1.9, -4.2, Math.log(Z));
    // the sky thins to space as it pulls back
    b4Sky(t, H - LB, 0, 0, 0, 0);
    if (space > 0) { for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) if (bay(x, y) < space * 1.15 - 0.05) BUF[y * W + x] = y < 60 ? 0 : 1 + (bay(x, y) < 0.3 ? 1 : 0); stars(t, H, fl(140 * space), 2311); }
    // the sun: a sky object, it hardly moves; in space it is a star with a corona
    const sunX = lerp(300, 360, pull), sunY = lerp(52, 64, pull), sunR = lerp(14, 10, pull);
    glow(sunX, sunY, sunR * (7 + space * 6), T_WARM, 0.55); discF(sunX, sunY, sunR * 1.25, 15); discF(sunX, sunY, sunR, 16); discF(sunX - 2, sunY - 2, sunR * 0.45, 22);
    if (space > 0.3) for (let k = 0; k < 6; k++) { const a = k * PI / 3 + t * 0.1; lineF(sunX, sunY, sunX + Math.cos(a) * sunR * 4 * space, sunY + Math.sin(a) * sunR * 4 * space, (x, y, u) => { if (bay(x, y) < 0.8 - u) P(x, y, 16); }); }
    // the Sunderer, a mountain standing in the cloud sea (he shrinks more slowly than everything: he is that big)
    const Zs = Math.pow(Z, 0.35), ss = 1.25 * Zs;
    b4Sund(AX + 290 * Zs, AY + lerp(10, -50, Zs), ss, t, { eyes: 1.4, tilt: -0.1, arms: [{ x: -104, y: 150, pose: 'fist', drift: 5 }, { x: 132, y: 96, pose: 'claw', drift: 7 }] });
    // the world under them
    b4Planet(AX, AY + 80 * Z, B4_RW * Z, t, sunX, sunY, 0);
    if (Z > 0.3) cloudBank(AY + 80 * Z + 6, 16 * Z, 70, 5051, t * 12, CLOUD_SUN, false);
    // the blade: it erupts from the broken hilt, swings down from overhead to level as it grows (too heavy to hold up),
    // and runs on out past the frame; it widens as it lengthens
    const S = 2.6 * Z, grow0 = eoc(b4Clip(0, 0.7, lt));
    const ang = lerp(-1.42, -0.2, eio(b4Clip(0.35, 2.4, lt))) + z5Knock(lt, -0.08, 9, 4);
    const big = S >= 0.55;
    let hand = [AX + 8 * S, AY];
    if (big) {
      const r = b4Inf(AX, AY, S, t, { sw: ang, spread: 1, flap: 0.3, wt: t * 1.8, orbR: 48 * Z, warp: 0.4, auraR: Math.max(4, 9 * Z), noLife: true, swl: 8, mouth: lt < 0.7 ? 2 : 0 });
      hand = r.hand;
    } else {
      // too far to see it: a star, its wings a cross of prism light
      const k = Math.max(0, S / 0.55);
      glow(AX, AY, 26, T_WH, 0.7); sparkle(AX, AY, 7 + Math.sin(t * 9) * 1.5, 22, PRISM[fl(t * 12) % 7]); discF(AX, AY, 1.6 + k * 2, 22);
      for (let q = 0; q < 4; q++) P(AX + Math.cos(t * 2.6 + q * PI / 2) * 6, AY + Math.sin(t * 2.6 + q * PI / 2) * 2, ORB[q][2]);
      hand = [AX + 2, AY];
    }
    const Ls = 40 + 1100 * grow0, w = Math.max(2.2, lerp(2.2, 5.5, Math.pow(Z, 0.3)));
    bigBlade(hand[0], hand[1], ang, Ls, w, t, { form: 'infinite', grow: lt < 0.7 ? 0.4 + 0.6 * grow0 : 1, surge: true, flare: 0.8 });
    // the blade's light along its whole length
    glow(hand[0] + Math.cos(ang) * 120, hand[1] + Math.sin(ang) * 120, 140, T_WH, 0.18);
    // the hit: the blade erupts
    if (lt < 0.03) impactFrame(hand[0], hand[1], 1);
    if (lt < 0.6) { shockRing(hand[0], hand[1], 8 + lt * 500, 8 + lt * 500, 3, [22, 85, 83], 1 - lt / 0.6); burst(hand[0], hand[1], lt / 0.4, 160, 18, 0.3, [22, 60], 3); }
    shk(7 * Math.exp(-lt * 3) + 0.6);
    z5Cam(1 + 0.06 * (1 - pull) + kick(lt, [[0, 2]])[0], 0.004 * z5N(t * 0.5, 1), 240, 135, 240, 135);
  });

  /* ================================================================ V.7 — he reaches for the sun (121.5–122.0) */
  // low, under him: the arm sweeps up on an arc, the hand opens wide over the sun, the palm meets it and the fingers
  // begin to close round it (they are shut on the cut, 122.0)
  const B4_SUN7 = [170, 74], B4_SR = 18, B4_SUNIN = 3.2;
  shot(121.5, 122.0, (lt, t) => {
    const CX = 300, CY = 160, s = 1.45, fs = 1.0, se = s * fs, [sx, sy] = B4_SUN7;
    const reach = eio(b4Clip(0, 0.3, lt)), close = eio(b4Clip(0.24, 0.5, lt)), held = lt >= 0.27;
    const a = -1.75 + 0.5 * (1 - reach), ux = Math.cos(a), uy = Math.sin(a), bob = Math.sin(t * 0.9) * s;
    // the wrist that puts his palm on the sun, reached on a bow from his side
    const W1 = [(sx - ux * (5.5 + B4_SUNIN) * se - CX) / s, (sy - uy * (5.5 + B4_SUNIN) * se - CY - bob) / s], P0 = [-122, 92], Pc = [-176, -6], q = 1 - reach;
    const wx = q * q * P0[0] + 2 * q * reach * Pc[0] + reach * reach * W1[0], wy = q * q * P0[1] + 2 * q * reach * Pc[1] + reach * reach * W1[1];
    b4Sky(t, H - LB, sx, sy, B4_SR, held ? 0 : 1);
    cloudBank(236, 26, 70, 5051, t * 10, CLOUD_SUN, false);
    cloudBank(252, 30, 50, 5052, t * 14, [17, 18, 19, 15], false);
    // the Worldblade's light still runs across the sky behind him
    bigBlade(-20, 210, -0.32, 900, 3, t, { form: 'infinite', flare: 0.7 });
    let SP = [sx, sy];
    const hold = held ? (I) => { SP = [I.palm[0] + I.ux * B4_SUNIN * I.s, I.palm[1] + I.uy * B4_SUNIN * I.s]; glow(SP[0], SP[1], B4_SR * 6, T_WARM, 0.5); b4DyingSun(SP[0], SP[1], B4_SR, t, 0); } : undefined;
    b4Sund(CX, CY, s, t, { eyes: 1.5, rage: 0.9, tilt: -0.14 * reach, nod: -4 * reach, lean: -6 * reach, arms: [{ x: wx, y: wy, pose: b4Pose('open', 'grab', close), ang: a, fs, hold }, { x: 132, y: 110, pose: 'fist', drift: 6 }] });
    // its light on his porcelain as the hand nears; then squeezing out between the closing fingers
    b4Leak(SP[0], SP[1], B4_SR, 46 + 40 * close, held ? 12 : 0, t, held ? 0.35 + 0.65 * close : 0.4 * reach, 2402);
    z5Cam(1.04 + 0.06 * reach, -0.02 * reach, lerp(250, 222, reach), lerp(122, 104, reach), 240, 135);
  });

  /* ================================================================ V.8 — he tears the sun out of the sky (122.0–124.6) */
  // his wrist in screen space (as sunderer() places it), so what he holds can be placed against his hand
  const b4Wr = (cx, cy, s, t, lx, ly) => [cx + lx * s, cy + Math.sin(t * 0.9) * s + ly * s];
  // only the pixels inside R of (cx, cy) turn to their negative: light inverted at a point of unbearable pressure
  function b4Inv(cx, cy, R, seed) {
    if (R < 1) return;
    for (let y = Math.max(LB, fl(cy - R)); y < Math.min(H - LB, cy + R); y++) for (let x = Math.max(0, fl(cx - R)); x < Math.min(W, cx + R); x++) {
      const d = Math.hypot(x - cx, y - cy) / R + (vn(x, y, 8, seed || 2401) - 0.5) * 0.25; if (d > 1 || (d > 0.85 && bay(x, y) > (1 - d) / 0.15)) continue;
      BUF[y * W + x] = INV[BUF[y * W + x]];
    }
  }
  // the sun in his hand, going out: amt 0 (the sun) .. 1 (a black sun)
  function b4DyingSun(x, y, r, t, amt) {
    if (amt >= 0.98) { blackSun(x, y, r, t, 1); return; }
    glow(x, y, r * 5 * (1 - amt), T_WARM, 0.6 * (1 - amt));
    if (amt > 0.4) blackSun(x, y, r, t, (amt - 0.4) / 0.6 * 0.9);
    discF(x, y, r * 1.2, amt > 0.5 ? 104 : 15); discF(x, y, r, amt > 0.5 ? 105 : 16);
    if (amt > 0) { discF(x, y, r * amt, 103); discF(x, y, r * amt * 0.85, 0); }
    else discF(x - r * 0.2, y - r * 0.2, r * 0.45, 22);
  }
  /* 0 the HIT: the fist shut round it · 0.1–1.0 it is torn down out of the sky on a long arc to before his chest, light
     dragged after it · 0.95–1.4 the other hand comes in and the two hands cup it · 1.55, 1.9, 2.15 three squeezes, light
     spurting between the fingers each time, the sun going dark · 2.2–2.6 the hands ease open on a black sun */
  shot(122.0, 124.6, (lt, t) => {
    const CX = 300, CY = 168, s = 1.3, fs = 1.08, se = s * fs;
    const pull = eio(b4Clip(0.1, 1.0, lt)), cr = eio(b4Clip(0.95, 1.4, lt)), rev = eio(b4Clip(2.2, 2.6, lt));
    const amt = eio(b4Clip(1.3, 2.35, lt)), r = lerp(B4_SR, 15, eio(b4Clip(1.35, 2.4, lt)));
    const sq = Math.max(0, z5Knocks(lt, [1.55, 1.9, 2.15], 1, 14, 5));
    let spurt = 0; for (const h of [1.55, 1.9, 2.15]) { const g = lt - h; if (g > 0) spurt = Math.max(spurt, Math.exp(-g * 7)); }
    // the left hand tearing it down: wrist (local) and angle along the arc
    const PL = (p) => [lerp(-90, -40, p) - Math.sin(p * PI) * 36, lerp(-62, 14, p) - Math.sin(p * PI) * 14, lerp(-1.95, -1.15, p)];
    const palmOf = (wx, wy, a) => [wx + Math.cos(a) * (5.5 + B4_SUNIN) * se, wy + Math.sin(a) * (5.5 + B4_SUNIN) * se];
    const [plx, ply, pa] = PL(pull), [w1x, w1y] = b4Wr(CX, CY, s, t, plx, ply);
    // the cup: where the sun sits once both hands have it (screen), the hands either side, fingers up and over it
    const [e1x, e1y] = b4Wr(CX, CY, s, t, PL(1)[0], PL(1)[1]), CUP = palmOf(e1x, e1y, PL(1)[2]);
    CUP[0] += 18 * cr; CUP[1] -= 6 * cr + 4 * rev;
    const g2 = r * 1.05 + 2 - sq * 4 + 9 * rev, aL2 = -PI / 2 + 0.5 - 0.25 * rev, aR2 = -PI / 2 - 0.5 + 0.25 * rev;
    const toLocal = (px, py, a) => [(px - Math.cos(a) * 5.5 * se - CX) / s, (py - Math.sin(a) * 5.5 * se - CY - Math.sin(t * 0.9) * s) / s];
    const [l2x, l2y] = toLocal(CUP[0] - g2, CUP[1] + 3, aL2), [r2x, r2y] = toLocal(CUP[0] + g2, CUP[1] + 3, aR2);
    const aL = lerp(pa, aL2, cr), wL = [lerp(plx, l2x, cr), lerp(ply, l2y, cr)];
    // the right hand comes in from his side on a bow
    const rb = Math.sin(cr * PI) * 26, aR = lerp(-1.4, aR2, cr), wR = [lerp(132, r2x, cr) + rb * 0.4, lerp(110, r2y, cr) + rb];
    // the grip: shut hard on the hit, harder on each squeeze, easing open at the end
    const gripL = cr > 0 ? b4Pose(b4Pose('claw', 'grab', cr), 'fist', 0.25 + sq * 0.5) : b4Pose('grab', 'fist', 0.15 + 0.35 * eoc(b4Clip(0, 0.15, lt)));
    const gripR = b4Pose(b4Pose('open', 'grab', cr), 'fist', 0.25 + sq * 0.5);
    const poseL = rev > 0 ? b4Pose(gripL, 'claw', rev) : gripL, poseR = rev > 0 ? b4Pose(gripR, 'claw', rev) : gripR;
    const sx0 = palmOf(...b4Wr(CX, CY, s, 122.0, PL(0)[0], PL(0)[1]), PL(0)[2]);
    const dark = eio(b4Clip(0.15, 2.3, lt));
    b4Sky(t, H - LB, 0, 0, 0, 0);
    cloudBank(232, 26, 70, 5051, t * 10, CLOUD_SUN, false);
    cloudBank(250, 30, 50, 5052, t * 14, [17, 18, 19, 15], false);
    // the hole the sun leaves: torn sky, burning at its edge, night inside
    const hole = eoc(b4Clip(0.1, 0.9, lt));
    if (hole > 0) for (let y = Math.max(LB, fl(sx0[1] - 44)); y < sx0[1] + 44; y++) for (let x = fl(sx0[0] - 50); x < sx0[0] + 50; x++) { const d = Math.hypot(x - sx0[0], (y - sx0[1]) * 1.1) / (28 * hole) + (vn(x, y, 5, 2411) - 0.5) * 0.5; if (d < 1) P(x, y, d > 0.85 ? 104 : d > 0.72 ? 102 : 0); }
    bigBlade(-20, 236, -0.3, 900, 3, t, { form: 'infinite', flare: 0.7 });
    const pS = palmOf(w1x, w1y, pa);
    glow(pS[0], pS[1], 200, T_WARM, 0.35 * (1 - amt));
    tintAll(T_DARK, 0.72 * dark);
    // dragged light, ripped out with it
    if (lt > 0.1 && lt < 1.3) for (let k = 1; k < 14; k++) { const p2 = eio(b4Clip(0.1, 1.0, lt - k * 0.025)), [qx, qy, qa] = PL(p2), [ax, ay] = palmOf(...b4Wr(CX, CY, s, t, qx, qy), qa), rr = r * (1 - k * 0.06); for (let yy = -rr; yy <= rr; yy++) for (let xx = -rr; xx <= rr; xx++) if (xx * xx + yy * yy < rr * rr && bay(fl(ax + xx), fl(ay + yy)) < 0.9 - k * 0.06) P(ax + xx, ay + yy, k < 4 ? 16 : k < 8 ? 15 : 14); }
    let SC = pS;
    const sunAt = (x, y) => b4DyingSun(x, y, r, t, amt);
    const hold = cr > 0 ? undefined : (I) => { SC = [I.palm[0] + I.ux * B4_SUNIN * I.s, I.palm[1] + I.uy * B4_SUNIN * I.s]; sunAt(SC[0], SC[1]); };
    const twoR = cr > 0.5;
    const arms = [{ x: wL[0], y: wL[1], pose: poseL, ang: aL, fs, front: true, hold, layer: cr > 0 ? 'palm' : undefined, heat: 0.9 },
      { x: wR[0], y: wR[1], pose: poseR, ang: aR, fs, front: cr > 0.3, layer: twoR ? 'palm' : undefined, heat: 0.9 }];
    // he hauls with his whole body: leans in and down after it, then hunches over it as he crushes
    const R_ = b4Sund(CX, CY, s, t, { eyes: 1.4 + 0.4 * dark, rage: 1, roar: 0.3 * eio(b4Clip(1.4, 2.0, lt)) + 0.25 * sq, tilt: -0.1 * (1 - pull) + 0.04 * sq, nod: 4 * pull + 3 * sq, lean: -8 * Math.sin(pull * PI) + 3 * cr, arms, heat: 0.9 });
    const hL = R_.hands[0], hR = R_.hands[1];
    if (cr > 0) {
      // both hands: the sun sits between the palms, the fingers close over it
      const mid = twoR ? [(hL.palm[0] + hR.palm[0]) / 2, (hL.palm[1] + hR.palm[1]) / 2 - 4] : CUP, al = Math.atan2(hL.knuckles[1] - hL.palm[1], hL.knuckles[0] - hL.palm[0]);
      const own = [hL.palm[0] + Math.cos(al) * B4_SUNIN * se, hL.palm[1] + Math.sin(al) * B4_SUNIN * se], k = eio(b4Clip(0, 0.6, cr));
      SC = [lerp(own[0], mid[0], k), lerp(own[1], mid[1], k)];
      sunAt(SC[0], SC[1]);
      b4Fing(hL, poseL, 0.9, -1);
      if (twoR) b4Fing(hR, poseR, 0.9, 1);
    }
    // light squeezed out between the fingers, spurting on each squeeze, dying as it goes black
    const lk = (1 - amt) * (cr > 0 ? 0.55 + 0.45 * spurt : 1);
    b4Leak(SC[0], SC[1], r, 50 + 110 * spurt, 14, t, lk, 2412, amt > 0.5 ? [105, 103] : [22, 16]);
    // the light sucked in toward it as it collapses
    if (amt > 0.2) { for (let k = 0; k < 40; k++) { const a = ih(k, 1, 2413) * TAU, u = frac(ih(k, 2, 2413) - t * 1.4), R = 24 + u * 160; if (bay(k, fl(t * 30)) < amt) lineP(SC[0] + Math.cos(a) * R, SC[1] + Math.sin(a) * R, SC[0] + Math.cos(a) * (R + 10 * u), SC[1] + Math.sin(a) * (R + 10 * u), u < 0.4 ? 15 : 14); } }
    if (lt < 0.03) impactFrame(SC[0], SC[1], 1);
    if (lt < 0.5) { shockRing(SC[0], SC[1], 6 + lt * 300, 6 + lt * 300, 3, [22, 16, 15], 1 - lt / 0.5); shk(6 * (1 - lt / 0.5)); }
    for (const h of [1.55, 1.9, 2.15]) { const g = lt - h; if (g > 0 && g < 0.3) { shk(4 * (1 - g / 0.3)); shockRing(SC[0], SC[1], r + g * 200, r + g * 200, 2, [105, 103, 101], 1 - g / 0.3); } }
    const [kz, kr] = kick(lt, [[0, 2], [1.55, 0.8], [1.9, 0.6], [2.15, 1]]);
    const fo = eio(b4Clip(0.5, 1.6, lt));
    z5Cam(1.0 + 0.3 * eio(b4Clip(1.2, 2.6, lt)) + kz, kr - 0.03 * (1 - pull), lerp(sx0[0] + 40, SC[0], fo), lerp(sx0[1] + 40, SC[1] - 10, fo), 240, 135);
  });

  /* ================================================================ V.9 — then we both end (124.6–126.2) */
  // the black sun held up over his head in both hands: the palms against its sides, the fingers spread over its face
  shot(124.6, 126.2, (lt, t) => {
    const CX = 240, CY = 178, s = 1.15, fs = 1.25, se = s * fs;
    b4Sky(t, H - LB, 0, 0, 0, 0);
    cloudBank(222, 26, 70, 5051, t * 10, CLOUD_SUN, false);
    tintAll(T_DARK, 0.8);
    stars(t, 120, 30, 2421);
    // the Worldblade, far off, the only light left in the sky
    bigBlade(-40, 120, -0.18, 900, 2, t, { form: 'infinite', flare: 0.6 });
    // he heaves it up (1.0–1.6): a dip first, then the lift
    const dip = Math.sin(b4Clip(0.7, 1.0, lt) * PI) * 0.4, lift = eio(b4Clip(1.0, 1.6, lt)), talk = t > 125.0 && t < 126.0 ? Math.max(0, Math.sin(t * 17)) * 0.35 : 0;
    const BR = 28 + 4 * eio(lt / 1.6) + Math.sin(t * 6) * 0.8, bob = Math.sin(t * 0.9) * s;
    const SX = CX + z5N(t * 0.8, 4) * 2, SY = CY + bob - (98 - 10 * dip + 22 * lift) * s;
    // the palms against its sides, a little below its middle, turned up and in
    const aL = -0.95 + 0.1 * Math.sin(t * 1.7), aR = PI + 0.95 - 0.1 * Math.sin(t * 1.5 + 1);
    const loc = (px, py, a) => [(px - Math.cos(a) * 5.5 * se - CX) / s, (py - Math.sin(a) * 5.5 * se - CY - bob) / s];
    const [lx, ly] = loc(SX - BR - 5, SY + BR * 0.3, aL), [rx, ry] = loc(SX + BR + 5, SY + BR * 0.3, aR);
    const grip = b4Pose('claw', 'grab', 0.4 + 0.2 * Math.sin(t * 2.1) + 0.3 * lift);
    const arms = [{ x: lx, y: ly, pose: grip, ang: aL, fs, front: true, layer: 'palm' }, { x: rx, y: ry, pose: grip, ang: aR, fs, front: true, layer: 'palm' }];
    // what light there is left streams into it
    for (let k = 0; k < 50; k++) { const a = ih(k, 1, 2422) * TAU, u = frac(ih(k, 2, 2422) - t * 0.9), R = BR + 6 + u * 220; lineP(SX + Math.cos(a) * R, SY + Math.sin(a) * R, SX + Math.cos(a) * (R + 4 + 14 * u), SY + Math.sin(a) * (R + 4 + 14 * u), u < 0.3 ? 105 : u < 0.6 ? 18 : 17); }
    warp(SX, SY, 90, 0.35, 1);
    const R_ = b4Sund(CX, CY, s, t, { eyes: 1.8, rage: 1, roar: talk, nod: -3 * lift + 3 * dip, lean: 2 * Math.sin(t * 0.8), arms, heat: 0.95 });
    // its corona drinks what light there is; tongues of fire lash out round his hands
    b4BSun(SX, SY, BR, t);
    for (let k = 0; k < 3; k++) { const a = -PI / 2 + (k - 1) * 0.9 + Math.sin(t * 2 + k) * 0.2; z5Ray(SX, SY, a, 60 + 20 * Math.sin(t * 3 + k), 4, 105, 103, 0.7); }
    b4Fing(R_.hands[0], grip, 0.95, -1); b4Fing(R_.hands[1], grip, 0.95, 1);
    // its fire licking up between his fingers
    b4Leak(SX, SY, BR, 26, 10, t, 0.6, 2423, [105, 103]);
    shk(0.6 + lift);
    z5Cam(1.05 + 0.1 * eio(lt / 1.6), 0.004 * z5N(t, 2), 240, lerp(140, 120, eio(lt / 1.6)), 240, 135);
  });
  CAPS.push([125.0, 126.6, 's', 'SUNDERER', 'THEN WE BOTH END.']);

  /* ================================================================ V.10 — the clash (126.2–134.0) */
  // the world with its sun gone: the morning sky drained to night, the cloud sea a dim floor
  function b4Night(t, hz, ox, dk) {
    b4Sky(t, H - LB, 0, 0, 0, 0);
    cloudBank(hz, 24, 70, 5051, (ox || 0) + t * 10, CLOUD_SUN, false);
    cloudBank(hz + 24, 30, 50, 5052, (ox || 0) * 1.4 + t * 14, [17, 18, 19, 15], false);
    tintAll(T_DARK, dk === undefined ? 0.8 : dk);
    stars(t, hz - 20, 26, 2501);
  }
  // the black sun with its rim burning hard enough to read against a night sky: the light bent round its edge
  function b4BSun(cx, cy, r, t) {
    glow(cx, cy, r * 2.4, T_EMBER, 0.3);
    blackSun(cx, cy, r, t, 1);
    const th = Math.max(1.5, r * 0.05);
    for (let q = 0; q < th; q += 0.7) ring(cx, cy, r + q, undefined, q < th * 0.5 ? 107 : 105);
    for (let a = 0; a < TAU; a += 0.9 / r) { const f = 0.5 + 0.5 * Math.sin(a * 5 + t * 3); if (f > 0.7) P(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2), 22); }
  }
  // the black sun held against the blade: from the hand along angle a, D px out, it presses on the edge from the side n
  const b4Press = (hx, hy, a, D, r, w, side) => { const ux = Math.cos(a), uy = Math.sin(a), sd = side || 1, nx = -uy * sd, ny = ux * sd; return { cx: hx + ux * D + nx * (r + w), cy: hy + uy * D + ny * (r + w), px: hx + ux * D + nx * w, py: hy + uy * D + ny * w }; };
  // where its hand will be, without leaving a mark (draw, read, put the picture back), so what is behind it can go first
  function b4HandPre(x, y, S, t, o) { Z5C.set(BUF); const r = b4Inf(x, y, S, t, o); BUF.set(Z5C); return r.hand; }
  // the point of contact: blade against black sun at the limit — the light there turns inside out, sparks and void spray
  function b4Contact(px, py, lt, t, power, dir, sun) {
    // one clean point of pressure: a small knot of inverted light, a white-hot core, a modest glow
    b4Inv(px, py, (6 + 2 * Math.sin(t * 5)) * power, 2511);
    glow(px, py, 26 * power, T_WH, 0.4);
    // the black sun's rim heated white where the edge bites into it, the heat running off round it
    if (sun) {
      const [cx, cy, r] = sun, ac = Math.atan2(py - cy, px - cx), sp = 0.55 * power;
      for (let da = -sp; da <= sp; da += 0.6 / r) { const f = 1 - Math.abs(da) / sp, a = ac + da; for (let q = -1.5; q <= 1.5 + f * 2; q += 0.7) { const x = cx + Math.cos(a) * (r + q - 1), y = cy + Math.sin(a) * (r + q - 1); if (bay(fl(x), fl(y)) < f * 1.2) P(x, y, f > 0.75 ? 22 : f > 0.4 ? 107 : 105); } }
    }
    discF(px, py, 1.4 + power * 1.1, 22);
    // a steady fountain of sparks off the contact, thrown both ways along the edge (dir is the normal), falling as they go
    const ea = dir - PI / 2;
    for (let k = 0; k < 28; k++) {
      const life = frac(t * 2.4 + ih(k, 1, 2512)); if (life > 0.82) continue;
      const a = ea + (k % 2 ? 0 : PI) + (ih(k, 2, 2512) - 0.5) * 0.8, v = (70 + ih(k, 3, 2512) * 120) * power, d = v * life * 0.55;
      const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d + 70 * life * life, tl = 1.5 + 5 * (1 - life);
      lineP(x, y, x - Math.cos(a) * tl, y - Math.sin(a) * tl, life < 0.25 ? 22 : k % 3 ? 105 : 85);
    }
    shk(1.2 * power);
  }
  /* 0–0.42 the wind-up: the black sun held overhead in both hands, he rears back with his whole body · 0.42–0.62 the hurl:
     the arms whip over and down at the hero, the sun leaves his hands at 0.56, the arms follow through and stay out, open,
     driving it with fire · 0.8 (127.0) the hero's swing meets it: the CLASH */
  shot(126.2, 129.0, (lt, t) => {
    const T0 = 126.2, tc = 127.0 - T0, rel = 0.56;
    b4Night(t, 206, 0);
    const wind = eio(b4Clip(0, 0.42, lt)), hurl = eic(b4Clip(0.42, rel, lt)), ft = eoc(b4Clip(rel, 0.85, lt)), settle = eio(b4Clip(0.85, 1.6, lt));
    const SCX = 430, SCY = 194, ss = 1.0, fs = 1.25, se = ss * fs, R = 38, bob = Math.sin(t * 0.9) * ss;
    // the hero at left: blade raised, then the swing down to meet it
    const sw = eic(b4Clip(0.62, tc, lt)), push = eoc(b4Clip(tc, 2.8, lt)) + z5Knock(lt - tc, 0.4, 10, 4);
    const HX = 118 - 14 * push + z5Sh(t, 1) * (lt > tc ? 1.2 : 0), HY = 186 + 6 * push, S = 1.5;
    const a = lt < tc ? lerp(0.75, -0.35, sw) : -0.35 + 0.12 * push, D = 160 - 18 * push, w = 4;
    const ho = { sw: a, spread: 1, flap: 0.3 + 0.2 * (lt > tc ? 1 : 0), wt: t * 2.2, orbR: 30, warp: 0.3, auraR: 6, noLife: true, mouth: lt > tc ? 2 : 0, eyes: 'glow', cracks: lt > tc ? 0.15 * push : 0, sq: lt > tc ? 0.1 * push : -0.05 }, hand = b4HandPre(HX, HY, S, t, ho);
    const C = b4Press(hand[0], hand[1], a, D, R, w, -1);
    // the sun in his hands (local, its centre): overhead, reared back, then whipped over and forward to the release
    const sL = lt < 0.42 ? [lerp(-8, 26, wind), lerp(-112, -120, wind)] : [lerp(26, -62, hurl), lerp(-120, -92, hurl) - Math.sin(hurl * PI) * 16];
    const held = lt < rel, toS = (lx, ly) => [SCX + lx * ss, SCY + bob + ly * ss];
    const [bx, by] = toS(...sL), [rx0, ry0] = toS(-62, -92);
    // the palms against its sides while he holds it, turned up and in; after the release they fly on open and stay out
    const aL0 = -0.95 - 0.5 * hurl, aR0 = PI + 0.95 - 0.5 * hurl;
    const wristAt = (px, py, aa) => [(px - Math.cos(aa) * 5.5 * se - SCX) / ss, (py - Math.sin(aa) * 5.5 * se - SCY - bob) / ss];
    const [hlx, hly] = wristAt(bx - R - 5, by + R * 0.3, aL0), [hrx, hry] = wristAt(bx + R + 5, by + R * 0.3, aR0);
    const [rlx, rly] = wristAt(rx0 - R - 5, ry0 + R * 0.3, -0.95 - 0.5), [rrx, rry] = wristAt(rx0 + R + 5, ry0 + R * 0.3, PI + 0.95 - 0.5);
    const [dlx, dly] = b4Idle(t, 0, 4), [drx, dry] = b4Idle(t, 1, 4);
    const outL = [lerp(rlx, -150, ft) + dlx * settle, lerp(rly, -4, ft) + dly * settle], outR = [lerp(rrx, -40, ft) + drx * settle, lerp(rry, 10, ft) + dry * settle];
    const gripP = b4Pose('claw', 'grab', 0.45 + 0.35 * wind), openP = b4Pose('grab', 'open', ft);
    const armL = held ? { x: hlx, y: hly, pose: gripP, ang: aL0, fs, front: true, layer: 'palm' } : { x: outL[0], y: outL[1], pose: openP, ang: lerp(-1.45, PI + 0.1, ft), fs, front: true };
    const armR = held ? { x: hrx, y: hry, pose: gripP, ang: aR0, fs, front: true, layer: 'palm' } : { x: outR[0], y: outR[1], pose: openP, ang: lerp(PI + 0.45, PI - 0.1, ft), fs, front: true };
    // the black sun's path: in his hands, then flung (fast, accelerating), then held hard on the blade
    const fl_ = eic(b4Clip(rel, tc, lt));
    const SX = held ? bx : lerp(rx0, C.cx, fl_), SY = held ? by : lerp(ry0, C.cy, fl_) - Math.sin(fl_ * PI) * 20;
    if (lt > rel && lt < tc) for (let k = 1; k < 6; k++) { const f2 = eic(b4Clip(rel, tc, lt - k * 0.025)); blackSun(lerp(rx0, C.cx, f2), lerp(ry0, C.cy, f2) - Math.sin(f2 * PI) * 20, R * (1 - k * 0.12), t, 0.5); }
    // the whole body throws it: rear back, then everything forward, then a slow settle into the push
    const lean = lt < 0.42 ? 12 * wind : lerp(12, -14, hurl) * (1 - settle) + (-7 + 1.5 * Math.sin(t * 1.3)) * settle - 3 * z5Knock(lt - tc, 1, 9, 4);
    const R_ = b4Sund(SCX, SCY, ss, t, { eyes: 1.8, rage: 1, roar: 0.25 + 0.5 * hurl * (1 - settle), nod: -5 * wind * (1 - hurl) + 7 * hurl * (1 - settle) + 3 * settle, tilt: 0.12 * hurl * (1 - settle) + 0.06 * settle, lean, arms: [armL, armR], heat: 0.95 });
    if (held) { b4BSun(SX, SY, R, t); b4Fing(R_.hands[0], gripP, 0.95, -1); b4Fing(R_.hands[1], gripP, 0.95, 1); b4Leak(SX, SY, R, 22, 10, t, 0.5, 2523, [105, 103]); }
    // he keeps it pressing: fire pours from his open palms into it
    if (lt > tc) for (const h of R_.hands.slice(0, 2)) z5Beam(h.palm[0], h.palm[1], C.cx, C.cy, 3 + Math.sin(t * 20), (f) => f < 0.4 ? 106 : f < 0.8 ? 104 : 102, t, 3);
    if (!held) b4BSun(SX, SY, R, t);
    const hero = b4Inf(HX, HY, S, t, ho);
    bigBlade(hero.hand[0], hero.hand[1], a, 1100, w, t, { form: 'infinite', flare: 0.8, surge: true });
    if (lt >= tc) { b4Contact(C.px, C.py, lt - tc, t, 1 + 0.3 * push, a + PI / 2, [C.cx, C.cy, R]); megaHit(C.px, C.py, lt - tc, 2.5, a + PI / 2, [22, 85, 83], 2521); }
    const [kz, kr] = kick(lt, [[tc, 2.5]]);
    z5Cam(1.0 + 0.12 * eio(b4Clip(tc, 2.8, lt)) + kz, kr, lerp(240, C.px, 0.5 * eio(b4Clip(tc, 2.8, lt))), 135, 240, 135);
  });

  // close: it holds, and it cannot; the blade cracks (130.0)
  shot(129.0, 131.0, (lt, t) => {
    const hc = 1.0, g = lt - hc;
    b4Night(t, 230, 40, 0.74);
    const push = lt * 0.4 + (g > 0 ? 0.6 : 0), kb = z5Knock(g, 14, 9, 4);
    const S = 3.4, HX = 132 - kb - 10 * lt + z5Sh(t, 2) * 1.6, HY = 176 + z5Sh(t, 3) * 1.2 + 4 * lt;
    const a = -0.1 + 0.04 * push, R = 56;
    const crk = clamp(0.2 + lt * 0.2 + (g > 0 ? 0.25 : 0), 0, 0.75);
    const ho = { sw: a, spread: 0.9, flap: 0.42, wt: t * 3.2, orbR: 0, warp: 0.25, auraR: 9, noLife: true, mouth: 2, eyes: g > 0 && g < 0.5 ? 'wide' : 'closed', cracks: crk, sq: 0.12 }, hand = b4HandPre(HX, HY, S, t, ho);
    const D = 168 - 10 * push, C = b4Press(hand[0], hand[1], a, D, R, 7, -1);
    b4BSun(C.cx, C.cy, R, t);
    const hero = b4Inf(HX, HY, S, t, ho);
    bigBlade(hero.hand[0], hero.hand[1], a, 1100, 7, t, { form: 'infinite', flare: 0.8, cracks: g > 0 ? 0.5 + 0.3 * lt : 0 });
    // the cracks race along the blade from the contact
    if (g > 0) for (let k = 0; k < 7; k++) { const u = clamp(g * 3, 0, 1) * (40 + ih(k, 1, 2531) * 160), s0 = (ih(k, 2, 2531) - 0.5) * 2 * u, ux = Math.cos(a), uy = Math.sin(a); let x = C.px - uy * 2, y = C.py + ux * 2; for (let q = 0; q < 8; q++) { const nx = x + ux * s0 / 8 + (ih(k, q, 2532) - 0.5) * 6, ny = y + uy * s0 / 8 + (ih(k, q, 2533) - 0.5) * 6; lineP(x, y, nx, ny, 0); x = nx; y = ny; } }
    b4Contact(C.px, C.py, lt, t, 1.4 + 0.3 * lt, a + PI / 2, [C.cx, C.cy, R]);
    if (g >= 0) megaHit(C.px, C.py, g, 2.6, a + PI / 2, [22, 85, 83], 2534);
    // grit and void ripped off its body by the pressure
    for (let k = 0; k < 14; k++) { const u = frac(ih(k, 1, 2535) + t * 1.8), x = HX + 50 - u * 260 + ih(k, 2, 2535) * 30, y = HY - 40 + ih(k, 3, 2535) * 90 + u * 20; if (bay(fl(x), fl(y)) < 1 - u) rectF(x, y, 2, 1, k % 3 ? 85 : 22); }
    const [kz, kr] = kick(lt, [[hc, 2]]);
    z5Cam(1.04 + 0.05 * lt + kz, kr - 0.02, 250, 130, 240, 135);
  });

  // wide: pushed back and back; the blade breaks at the tip (132.0)
  shot(131.0, 132.6, (lt, t) => {
    const hb = 1.0, g = lt - hb;
    b4Night(t, 206, 80, 0.74);
    const push = eio(lt / 1.6) + z5Knock(g, 0.5, 9, 4), S = 1.5;
    const HX = 112 - 34 * push + z5Sh(t, 1) * 1.5, HY = 190 + 14 * push + z5Sh(t, 2);
    const a = -0.3 + 0.16 * push, R = 46, w = 4;
    const ho = { sw: a, spread: 0.7, flap: 0.4, wt: t * 3, orbR: 24, orbA: 1.2, warp: 0.2, auraR: 5, noLife: true, mouth: 2, eyes: 'closed', cracks: 0.5 + 0.2 * lt, sq: 0.18 }, hand = b4HandPre(HX, HY, S, t, ho);
    const D = 150 - 12 * push, C = b4Press(hand[0], hand[1], a, D, R, w, -1);
    z5Beam(W + 20, 30, C.cx, C.cy, 5 + Math.sin(t * 20), (f) => f < 0.4 ? 106 : f < 0.8 ? 104 : 102, t, 5);
    // past the contact the blade is breaking: from the hit the far part shears off and is flung away, spinning to shards
    const L = 1100, snap = (D + R * 0.6) / L, off = g > 0 ? [Math.cos(a + 0.5) * g * 300, Math.sin(a + 0.5) * g * 300 + g * g * 80] : [0, 0];
    b4BSun(C.cx, C.cy, R, t);
    const hero = b4Inf(HX, HY, S, t, ho);
    bigBlade(hero.hand[0], hero.hand[1], a, L, w, t, g > 0 ? { form: 'infinite', flare: 0.6, cracks: 0.6, snap, snapOff: off } : { form: 'infinite', flare: 0.6, cracks: 0.5 });
    b4Contact(C.px, C.py, lt, t, 1.1, a + PI / 2, [C.cx, C.cy, R]);
    if (g >= 0) { megaHit(C.px, C.py, g, 2.9, a, [22, 85, 83], 2541); const sx = hero.hand[0] + Math.cos(a) * snap * L, sy = hero.hand[1] + Math.sin(a) * snap * L; rocks(sx, sy, g, 26, 260, 3, [83, 85, 22, 22], 2542, 120, a + 0.4, 1.8); }
    const [kz, kr] = kick(lt, [[hb, 3]]);
    z5Cam(1.02 + kz, kr, 230, 140, 240, 135);
  });

  // close: on its knees in the air under it; the wings sag; nothing left
  shot(132.6, 134.0, (lt, t) => {
    b4Night(t, 236, 120, 0.8);
    const S = 3.4, sink = eoc(lt / 1.4), tr = z5Sh(t, 4) * (1.2 + lt);
    const HX = 196 + tr * 0.8, HY = 176 + 8 * sink + tr * 0.5, a = -1.0 + 0.08 * sink + z5Sh(t, 5) * 0.02;
    const eyes = lt < 1.12 ? 'closed' : lt < 1.28 ? 'wide' : 'glow';
    const ho = { sw: a, ang: 0.22 * sink, spread: 0.45 - 0.15 * sink, flap: 0.08, wt: t * 0.8, orbR: 30, orbA: 1.0, warp: 0.1, auraR: 4, noLife: true, mouth: lt > 1.25 ? 2 : 0, eyes, cracks: 0.75, sq: 0.24, legs: [4, 2, 4, 2] }, hand = b4HandPre(HX, HY, S, t, ho);
    const R = 78, C = b4Press(hand[0], hand[1], a, 100, R, 6, -1);
    b4BSun(C.cx, C.cy, R, t);
    const hero = b4Inf(HX, HY, S, t, ho);
    bigBlade(hero.hand[0], hero.hand[1], a, 150, 6, t, { form: 'infinite', flare: 0.4, cracks: 0.7, snap: 0.999 });
    b4Contact(C.px, C.py, lt, t, 0.9, a + PI / 2, [C.cx, C.cy, R]);
    // the dark closes in from the edges
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const d = Math.hypot((x - HX) / 260, (y - HY) / 150); if (d > 0.6) tintI(y * W + x, x, y, T_DARK, (d - 0.6) * 1.2 * (0.5 + 0.5 * sink)); }
    if (lt > 1.28) glow(HX, HY, 60, T_WH, 0.3 * (lt - 1.28) / 0.12);
    z5Cam(1.05 + 0.18 * eio(lt / 1.4), 0.01 * z5N(t, 6), lerp(200, HX, 0.5), lerp(140, HY, 0.6), 240, 135);
  });

  /* ================================================================ V.11 — FURTHER!! (134.0–135.75) */
  shot(134.0, 135.75, (lt, t) => {
    const er = eoc(b4Clip(0, 0.35, lt)), rise = eio(b4Clip(0.1, 1.2, lt)), wind = eio(b4Clip(1.25, 1.75, lt));
    b4Night(t, 236, 120 + lt * 20, 0.9 - 0.25 * er);
    const tr = z5Sh(t, 4) * (2.5 - rise * 1.5);
    const HX = 196 - 30 * wind + tr, HY = 184 - 16 * rise + tr * 0.5;
    const ov = er * (1 - 0.3 * wind), S = 2.8;
    const a = lerp(-0.92, -2.0, wind) + z5Sh(t, 5) * 0.03 * (1 - wind);
    const ho = { sw: a, ang: lerp(0.22, -0.06, rise) - 0.1 * wind, spread: lerp(0.3, 1, er), flap: 0.32, wt: t * 3.4, over: ov, orbR: 62, orbA: 1 + er, warp: 0.5 * er, rays: 120 * er, auraR: 6 + 8 * er, noLife: true, mouth: 2, eyes: 'glow', cracks: 0.75 * (1 - rise), sq: lerp(0.24, -0.1, rise), legs: rise < 0.6 ? [4, 2, 4, 2] : undefined };
    const hand = b4HandPre(HX, HY, S, t, ho);
    // the black sun forced back up off it
    const R = 78, C = b4Press(hand[0], hand[1], -0.92, 100 + 40 * rise, R, 6, -1);
    const sx = C.cx + 40 * wind, sy = C.cy - 30 * rise - 20 * wind;
    b4BSun(sx, sy, R, t);
    // the dark blown back from it in a ring of every colour
    if (lt < 1.2) { shockRing(HX, HY, 10 + lt * 420, 10 + lt * 420, 5, [22, PRISM[fl(t * 20) % 7], PRISM[(fl(t * 20) + 3) % 7]], 1 - lt / 1.2); shockRing(HX, HY, 6 + lt * 260, 6 + lt * 260, 3, [22, 60, 59], 1 - lt / 0.9); }
    const hero = b4Inf(HX, HY, S, t, ho);
    // the blade regrows past the frame, its cracks sealing in light
    const L = lerp(150, 1400, eoc(b4Clip(0.2, 1.1, lt)));
    bigBlade(hero.hand[0], hero.hand[1], a, L, 6 + 2 * rise, t, { form: 'infinite', flare: 0.9, grow: lt < 1.1 ? 0.6 + 0.4 * eoc(b4Clip(0.2, 1.1, lt)) : 1, surge: true, cracks: 0.7 * (1 - rise) });
    if (wind < 0.1) b4Contact(C.px, C.py, lt, t, 0.9 + er * 0.6, -0.92 + PI / 2);
    if (lt < 0.03) impactFrame(HX, HY, 1);
    shk(3 + 4 * er * (1 - lt / 1.75));
    z5Cam(1.08 - 0.1 * eio(b4Clip(0.2, 1.75, lt)) + kick(lt, [[0, 2]])[0], 0.01 * z5N(t, 3), lerp(HX + 10, 240, eio(b4Clip(0.3, 1.75, lt))), lerp(HY - 40, 120, eio(b4Clip(0.3, 1.75, lt))), 240, 135);
  });
  CAPS.push([134.2, 135.6, 'x', '', 'FURTHER!!', 62]);

  /* ================================================================ V.12 — into the black sun (135.75–138.0) */
  const B4_BS = [304, 98, 58];
  // half a black sun: blackSun, keeping only the side sd of the line through (cx, cy) with normal (nx, ny); the cut face
  // burns white-hot
  function b4HalfSun(cx, cy, r, t, nx, ny, sd, open, fade) {
    const R = r * 3.2, x0 = Math.max(0, fl(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R)), y0 = Math.max(LB, fl(cy - R)), y1 = Math.min(H - LB - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, side = (dx * nx + dy * ny) * sd; if (side < 0 || (fade && vn(x, y, 3, 2612) * 0.7 + bay(x, y) * 0.3 < fade)) continue;
      const d = Math.sqrt(dx * dx + dy * dy), an = Math.atan2(dy, dx);
      if (d < r) { BUF[y * W + x] = side < 2 + open * 3 ? (side < 1.2 ? 22 : 107) : d > r - 1.6 ? 105 : d > r - 3 ? 102 : 0; continue; }
      const tongue = r * (1.15 + 0.5 * Math.max(0, Math.sin(an * 7 + t * 2.3) * Math.sin(an * 3 - t * 1.1)) + 0.35 * vn(an * 4 + t, 0, 1, 1151)) * (1 - open * 0.6);
      if (d < tongue) { const e = (d - r) / Math.max(1, tongue - r); BUF[y * W + x] = e < 0.2 ? 107 : e < 0.45 ? 105 : e < 0.7 ? 103 : bay(x, y) < 0.5 ? 102 : 101; }
    }
  }
  shot(135.75, 138.0, (lt, t) => {
    const tc = 0.25, g = lt - tc, [BX, BY, R] = B4_BS;
    b4Night(t, 214, 160, 0.74);
    const drive = eio(b4Clip(tc, 2.25, lt)), HX = 128 + 22 * drive + z5Sh(t, 1) * 1.4 * (g > 0 ? 1 : 0), HY = 188 - 6 * drive + z5Sh(t, 2) * (g > 0 ? 1 : 0), S = 1.9;
    // the swing comes down from overhead; at the hit it is the tangent of the black sun, and it grinds on in toward the
    // centre line
    const ho0 = { sw: -1.2, noLife: true };
    const hand = b4HandPre(HX, HY, S, t, Object.assign({}, ho0, { orbR: 0 }));
    const dC = Math.atan2(BY - hand[1], BX - hand[0]), dd = Math.hypot(BX - hand[0], BY - hand[1]), tan = dC - Math.asin(R / dd);
    const a = lt < tc ? lerp(-2.1, tan, eic(lt / tc)) : lerp(tan, dC, drive) + z5Sh(t, 3) * 0.008;
    b4BSun(BX, BY, R, t);
    const hero = b4Inf(HX, HY, S, t, { sw: a, spread: 1, flap: 0.36, wt: t * 3, over: 0.35, orbR: 36, orbA: 2, warp: 0.35, auraR: 7, noLife: true, mouth: 2, eyes: 'glow', sq: g > 0 ? 0.08 : -0.1 });
    bigBlade(hero.hand[0], hero.hand[1], a, 1400, 5, t, { form: 'infinite', flare: 1, surge: true });
    // where the blade is inside it: light pours from the wound, and its edges throw sparks
    if (g > 0) {
      const ux = Math.cos(a), uy = Math.sin(a), px = BX - hero.hand[0], py = BY - hero.hand[1], m = px * ux + py * uy, q = Math.abs(-px * uy + py * ux), hc = Math.sqrt(Math.max(0, R * R - q * q));
      const e1 = [hero.hand[0] + ux * (m - hc), hero.hand[1] + uy * (m - hc)], e2 = [hero.hand[0] + ux * (m + hc), hero.hand[1] + uy * (m + hc)];
      for (const [ex, ey] of [e1, e2]) { b4Contact(ex, ey, lt, t, 0.8 + 0.4 * drive, a - PI / 2, [BX, BY, R]); }
      for (let k = 0; k < 6; k++) { const u = (k + 0.5) / 6, x = lerp(e1[0], e2[0], u), y = lerp(e1[1], e2[1], u); z5Ray(x, y, a - PI / 2 + Math.sin(t * 9 + k) * 0.2, 10 + 30 * drive * ih(k, fl(t * 15), 2601), 2, 22, 60, 0.8); }
      glow((e1[0] + e2[0]) / 2, (e1[1] + e2[1]) / 2, 40 + 60 * drive, T_WH, 0.35 + 0.2 * drive);
      megaHit(e1[0], e1[1], g, 2.8, a, [22, 85, 83], 2602);
    }
    const [kz, kr] = kick(lt, [[tc, 3]]);
    z5Cam(1.0 + 0.1 * drive + kz, kr, lerp(240, 250, drive), 135, 240, 135);
  });

  /* ================================================================ V.13 — the black sun splits; the light comes back (138.0–139.6) */
  shot(138.0, 139.6, (lt, t) => {
    const [BX, BY, R] = B4_BS, op = eoc(b4Clip(0, 1.2, lt));
    b4Night(t, 214, 200, 0.74 - 0.52 * eio(b4Clip(0, 1.4, lt)));
    // the light that was in it, flooding out across the sky
    z5GodRays(BX, BY, 9, t * 0.5, T_WARM, 0.7 * op, 520);
    glow(BX, BY, 60 + 200 * op, T_WH, 0.55 * (1 - 0.4 * op));
    // the Sunderer, seen behind it as it comes apart: rocked back by the light
    b4Sund(420, 150 + 6 * op, 1.0, t, { eyes: 1.6, rage: 1, roar: 0.6 * op, tilt: 0.1 * op, nod: -4 * op, arms: [{ x: -150, y: -10 - 30 * op, pose: b4Pose('claw', 'open', op), ang: -2.3 - 0.4 * op, front: true }, { x: 110, y: 80, pose: 'fist', drift: 6 }], lean: 8 * op, heat: 0.9 });
    const HX = 150, HY = 182, S = 1.9, a = -0.47;
    const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, gap = 6 + 70 * op;
    for (const sd of [-1, 1]) b4HalfSun(BX + nx * gap * sd + ux * 20 * op * sd, BY + ny * gap * sd + 30 * op * op, R * (1 - 0.15 * op), t, nx, ny, sd, op, sstep(0.3, 1.4, lt));
    // the seam of light between the halves
    for (let k = -1; k <= 1; k++) lineF(BX - ux * 300, BY - uy * 300 + k, BX + ux * 300, BY + uy * 300 + k, (x, y) => { if (bay(x, y) < 1 - op * 0.6) P(x, y, k ? 60 : 22); });
    for (let k = 0; k < 30; k++) { const u = frac(ih(k, 1, 2611) + lt * 0.8), d = (ih(k, 2, 2611) - 0.5) * 2 * R, x = BX + ux * d + nx * (ih(k, 3, 2611) - 0.5) * gap * 2 + nx * u * 40 * (k % 2 ? 1 : -1), y = BY + uy * d + ny * (ih(k, 3, 2611) - 0.5) * gap * 2 + u * u * 40; if (bay(fl(x), fl(y)) < 1 - u) rectF(x, y, 2, 2, k % 3 ? 105 : 103); }
    const hero = b4Inf(HX, HY, S, t, { sw: a, spread: 1, flap: 0.3, wt: t * 2.6, orbR: 36, orbA: 2, warp: 0.3, auraR: 6, noLife: true, mouth: lt < 0.6 ? 2 : 0, eyes: 'glow', rays: 70 * op });
    bigBlade(hero.hand[0], hero.hand[1], a, 1400, 5, t, { form: 'infinite', flare: 1, surge: true });
    if (lt < 0.03) impactFrame(BX, BY, 1);
    shockRing(BX, BY, 10 + lt * 500, 10 + lt * 500, 5, [22, 16, 15], 1 - lt / 1.0);
    shk(7 * Math.exp(-lt * 3));
    const [kz, kr] = kick(lt, [[0, 3]]);
    z5Cam(1.08 - 0.06 * op + kz, kr, 260, 135, 240, 135);
  });

  /* ================================================================ V.14 — the final combo (139.6–145.0) */
  // five cuts, each taking part of him; his state at any moment of it (absolute t)
  const B4_C = [140.0, 140.6, 141.2, 141.8, 142.4];
  const B4_MASKA = 1.93;                                   // the line the mask is cut along (mask frame)
  const B4_STOP = 0.1;                                     // each cut holds on its contact for three frames
  function b4SundC(cx, cy, s, t, o) {
    const ul = t < B4_C[0] ? o.ul : null, l0 = t < B4_C[2], l1 = t < B4_C[4], half = t >= B4_C[3] && o.mask !== false;
    const wound = (o.wounds || []).concat(t >= B4_C[2] ? [[-110, 64, 80, 178, 3 + 2 * Math.min(1, (t - B4_C[2]) * 6)]] : []);
    const so = Object.assign({ heat: 0.95, rage: 1, third: 1, eyes: 1.6, crown: t < B4_C[1] ? 1 : 0.22, maskCuts: B4_MCUT }, o, { wounds: wound, arms: [ul, o.ur || null, l0 ? B4_LOW[0] : null, l1 ? B4_LOW[1] : null] });
    if (half) so.mask = false;
    const r = sunderer(cx, cy, s, t, so);
    // where an arm was taken at the shoulder: a burning socket, riding the shoulders' lean
    if (!o.split) for (const [k, gone] of [[0, !ul], [2, !l0], [3, !l1]]) if (gone && (k !== 0 || t >= B4_C[0])) { const [lx, ly] = SH4[k], X = cx + (lx + r.lean * (k < 2 ? 0.85 : 0.6)) * s, Y = cy + Math.sin(t * 0.9) * s + ly * s; discF(X, Y, 9 * s, 101); discF(X, Y, 6 * s, 103); discF(X, Y, 3 * s, 105); glow(X, Y, 22 * s, T_EMBER, 0.4); for (let q = 0; q < 4; q++) { const g = frac(t * 0.9 + ih(k, q, 2701)); rectF(X + (ih(k, q, 2702) - 0.5) * 14 * s, Y + 8 * s + g * 60 * s, Math.max(1, s * 1.5), Math.max(2, s * 3), g < 0.5 ? 105 : 103); } }
    if (half) b4MaskPart(cx, cy, s, t, so, 1, null, 0, r.lean);
    return r;
  }
  // one side of his mask (side +1 keeps the right of the cut, -1 the left), placed exactly as sunderer() places it (with
  // its lean and shake), moved by off and turned by rot (the half that falls); the kept half shows the molten inside of
  // his head where the other was, with relief and the glow of the cut on it
  function b4MaskPart(cx, cy, s, t, o, side, off, rot, lean) {
    cy += Math.sin(t * 0.9) * s;
    const sh = o.shake ? z5Sh(t, 7) * o.shake : 0;
    const mcx = cx + Math.sin(t * 0.6) * 0.6 * s + sh + (lean || 0) * s * 0.95 + (off ? off[0] : 0), mcy = cy + Math.sin(t * 0.9 - 0.8) * 0.5 * s + (o.nod || 0) * s + (off ? off[1] : 0);
    const tilt = Math.sin(t * 0.47) * 0.035 + (o.tilt || 0) + (rot || 0), cT = Math.cos(tilt), sT = Math.sin(tilt), ax = Math.cos(B4_MASKA), ay = Math.sin(B4_MASKA);
    const spl = o.split || 0, sa = o.splitA === undefined ? 1.2 : o.splitA, sux = Math.cos(sa), suy = Math.sin(sa), spx = o.splitX || 0, spy = o.splitY || 0;
    const sideOf = (lx, ly) => ((lx - spx) * -suy + (ly - spy) * sux) > 0 ? 1 : -1;
    const slide = (sd) => [-suy * sd * spl * 40 + sux * sd * spl * 10, sux * sd * spl * 40 + suy * sd * spl * 10 + spl * spl * 30];
    const R = 30 * s + spl * 50 * s, x0 = Math.max(0, fl(mcx - R)), x1 = Math.min(W - 1, Math.ceil(mcx + R)), y0 = Math.max(0, fl(mcy - R)), y1 = Math.min(H - 1, Math.ceil(mcy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let qx = (x + 0.5 - mcx) / s, qy = (y + 0.5 - mcy) / s;
      if (spl > 0) { let hit = null; for (const sd2 of [1, -1]) { const [ox, oy] = slide(sd2), a2 = qx - ox, b2 = qy - oy; if (sideOf(a2, b2) === sd2) { hit = [a2, b2]; break; } } if (!hit) continue; qx = hit[0]; qy = hit[1]; }
      const mx = qx * cT + qy * sT, my = -qx * sT + qy * cT;
      const c = sMaskPx(mx, my, x, y, t, o); if (c < 0) continue;
      if (spl > 0 && Math.abs((qx - (o.splitX || 0)) * -suy + (qy - (o.splitY || 0)) * sux) < 1.2) { BUF[y * W + x] = 22; continue; }
      const sd = (mx * ay - my * ax) * -1, e = Math.abs(sd);
      if (sd * side < 0) {
        if (side > 0 && !off) {
          // the inside of his head: black stone in relief, lit by the cut, molten seams running back from it
          const hgt = vn(mx, my, 2.6, 2703) * 1.4 + vn(mx, my, 6, 2704), gx = vn(mx + 0.6, my, 2.6, 2703) * 1.4 + vn(mx + 0.6, my, 6, 2704) - hgt, lit = 0.4 - gx * 3 - e * 0.05;
          BUF[y * W + x] = e < 1.2 ? 107 : e < 2.4 ? 105 : seamAt(mx / 4 + 7, my / 4) < 0.06 ? (e < 8 ? 104 : 102) : e < 4.5 ? 102 : OBS[clamp(fl(lit * 3 + (bay(x, y) - 0.5) * 0.8), 0, 3)];
        }
        continue;
      }
      BUF[y * W + x] = e < 0.9 ? 22 : e < 1.8 ? 105 : c;
    }
  }
  // a hero from a key track, Infinite, with its giant blade: afterimages on the dash, a stretch along it, and the slash
  // of light its blade leaves when it turns fast; stop: the track time of a hit to hold on for B4_STOP (the hit-stop)
  function b4Fighter(keys, lt, t, S, L, w, extra, stop) {
    const tk = (x) => stop === undefined ? x : stopClock(x, [stop], B4_STOP)[0];
    const p = z5Trk(keys, tk(lt)), q = z5Trk(keys, tk(lt - 1 / 30)), vx = (p.x - q.x) * 30, vy = (p.y - q.y) * 30, sp = Math.hypot(vx, vy);
    const after = []; if (sp > 300) for (let k = 1; k <= 4; k++) { const a = z5Trk(keys, tk(lt - k * 0.03)); after.push([a.x, a.y, k === 1 ? 22 : PRISM[(k * 2 + fl(t * 30)) % 7], 0.6 - k * 0.13]); }
    // in the combo it is drawn lean: small orbs, no warp, a tight aura, so the silhouette and the blade read
    const r = b4Inf(p.x, p.y, S, t, Object.assign({ sw: p.sw, ang: p.a || 0, noLife: true, after, st: clamp((sp - 150) / 1500, 0, 0.45), sd: Math.atan2(vy, vx), spread: 1, flap: 0.36, wt: t * 3, orbR: 13 * S, orbA: 1.2, auraR: 2.6 * S, mouth: 2, warp: 0 }, extra || {}));
    const N = 5, wa = []; for (let k = 0; k <= N; k++) wa.push(z5Trk(keys, tk(lt - k / 30)).sw);
    let m = 0, nw = -1; for (let k = 0; k < N; k++) if (Math.abs(wa[k] - wa[k + 1]) > 0.12) { m = k + 1; if (nw < 0) nw = k; }
    if (m) b4Arc(r.hand[0], r.hand[1], wa[m], wa[0] - wa[m], L * 1.02, nw / N * 0.9);
    const tip = bigBlade(r.hand[0], r.hand[1], p.sw, L, w, t, { form: 'infinite', flare: 0.5, surge: true });
    return { p, hand: r.hand, tip, sp };
  }
  // the slash a giant blade leaves in the combo: only a thin crescent near its tip (the old full-width fan hid the bodies),
  // white at the leading edge, a band of prism, dissolving into its tail
  function b4Arc(hx, hy, a0, d, L, fade) {
    const ad = Math.min(Math.abs(d), TAU - 0.05); if (ad < 0.3 || fade >= 1) return;
    const R = L * 1.06, x0 = Math.max(0, fl(hx - R)), x1 = Math.min(W - 1, Math.ceil(hx + R)), y0 = Math.max(LB, fl(hy - R)), y1 = Math.min(H - LB - 1, Math.ceil(hy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (SMASK[i]) continue;
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy, r = Math.sqrt(dx * dx + dy * dy); if (r > R || r < L * 0.7) continue;
      let rel = Math.atan2(dy, dx) - a0; rel = d > 0 ? ((rel % TAU) + TAU) % TAU : ((-rel % TAU) + TAU) % TAU;
      if (rel > ad) continue;
      const u = rel / ad, rin = L * (0.97 - 0.13 * Math.pow(u, 1.5)), rout = L * 1.02; if (r < rin || r > rout) continue;
      const e = (r - rin) / (rout - rin); if (bay(x, y) > u * 1.5 - fade * 1.8 - 0.15) continue;
      BUF[i] = u > 0.95 || e > 0.9 ? 22 : u > 0.75 ? 60 : PRISM[fl(e * 6.99)];
    }
  }
  // where a blade from hand at angle a passes a target: the point on the blade nearest it (the contact), and how far off
  function b4OnBlade(hand, a, T) { const ux = Math.cos(a), uy = Math.sin(a), d = (T[0] - hand[0]) * ux + (T[1] - hand[1]) * uy; return [hand[0] + ux * d, hand[1] + uy * d, Math.abs(-(T[0] - hand[0]) * uy + (T[1] - hand[1]) * ux)]; }
  /* a cut landing, g seconds after: ONE impact frame; then the held contact (the stroke of light left across him along the
     blade, a hot point where it bites); sparks thrown on along the stroke, molten spatter back; a tight ring; the shake.
     Small glow: the hit is read off the bodies, not off a white-out */
  function b4Cut(x, y, g, a, seed, pw) {
    if (g < 0 || g > 0.8) return;
    pw = pw || 1;
    if (g < 1 / 60) impactFrame(x, y, 0);
    const ux = Math.cos(a), uy = Math.sin(a);
    if (g < B4_STOP + 0.07) {
      const k = 1 - g / (B4_STOP + 0.07), L = 64 * pw;
      thick(x - ux * L * k, y - uy * L * k, x + ux * L, y + uy * L, 1, 22);
      lineP(x - ux * L * 0.6 - uy * 2, y - uy * L * 0.6 + ux * 2, x + ux * L * 0.8 - uy * 2, y + uy * L * 0.8 + ux * 2, 60);
      discF(x, y, 2 + 3 * k * pw, 22);
      glow(x, y, 22 * pw, T_WH, 0.5 * k);
    }
    if (g < 0.55) {
      const f = g / 0.55;
      for (let k = 0; k < 22 * pw; k++) {
        const aa = a + (ih(k, 1, seed) - 0.5) * 0.9, v = (120 + ih(k, 2, seed) * 260) * pw, dd = v * g * (1 - g * 0.8), px = x + Math.cos(aa) * dd, py = y + Math.sin(aa) * dd + 120 * g * g;
        if (bay(fl(px), fl(py)) > 1.1 - f) continue;
        const tl = 2 + v * 0.02 * (1 - f); lineP(px, py, px - Math.cos(aa) * tl, py - Math.sin(aa) * tl, k % 3 ? 85 : 22);
      }
      for (let k = 0; k < 12 * pw; k++) {
        const aa = a + PI + (ih(k, 3, seed) - 0.5) * 1.6, v = (40 + ih(k, 4, seed) * 110) * pw, px = x + Math.cos(aa) * v * g, py = y + Math.sin(aa) * v * g + 220 * g * g;
        if (bay(fl(px), fl(py)) > 1.05 - f) continue;
        rectF(px, py, 2, 2, f < 0.4 ? 105 : 103);
      }
      shockRing(x, y, 6 + g * 160 * pw, 4 + g * 70 * pw, 1, [22, 85, 83], 1 - g / 0.3);
    }
    glow(x, y, 50 * pw * Math.max(0, 1 - g * 2), T_GOLD, 0.3);
    shk(5 * pw * Math.max(0, 1 - g * 3));
  }
  // a severed arm: shoulder (ax, ay), elbow, wrist (or null for a stump) as they were at the cut, g seconds ago, thrown
  // along (vx, vy) and turning about its middle; the fingers spasm and go slack, and the cut end bleeds fire
  function b4Limb(ax, ay, ex, ey, wx, wy, s, g, vx, vy, spin, pose, k, t) {
    if (g < 0) return;
    const ox = wx === null ? (ax + ex) / 2 : (ax + ex + wx) / 3, oy = wx === null ? (ay + ey) / 2 : (ay + ey + wy) / 3;
    const mx = ox + vx * g, my = oy + vy * g + 160 * g * g, rot = spin * g, c = Math.cos(rot), sn = Math.sin(rot);
    const rp = (x, y) => { const dx = x - ox, dy = y - oy; return [mx + dx * c - dy * sn, my + dx * sn + dy * c]; };
    const pa = rp(ax, ay), pe = rp(ex, ey), pw = wx === null ? null : rp(wx, wy);
    const twitch = b4Pose(pose || 'open', 'claw', 0.5 + 0.5 * Math.sin(g * 34) * Math.exp(-g * 3));
    b4ArmLook(pa[0], pa[1], pe[0], pe[1], pw ? pw[0] : null, pw ? pw[1] : null, s, 0.3 + 0.5 * Math.exp(-g * 1.5), k, twitch, undefined, t);
    for (let q = 1; q < 7; q++) { const gg = g - q * 0.03; if (gg > 0) { const [qx, qy] = [ox + vx * gg, oy + vy * gg + 160 * gg * gg], d = [pa[0] - mx, pa[1] - my]; rectF(qx + d[0], qy + d[1], 2, 2, q < 3 ? 105 : 103); } }
    glow(pa[0], pa[1], 18 * s, T_EMBER, 0.5 * Math.exp(-g * 2));
  }
  // the crown's blades, cut loose and flung
  function b4CrownShards(cx, cy, s, g, seed) {
    if (g < 0 || g > 2) return;
    for (let k = 0; k < 9; k++) {
      const a = -PI + (k + 0.5) / 9 * PI, v = (90 + ih(k, 1, seed) * 140), x = cx + Math.cos(a) * (40 * s + v * g), y = cy - 8 * s + Math.sin(a) * (40 * s + v * g) + 200 * g * g, r = g * (4 + ih(k, 2, seed) * 8) + a, L = (24 + ih(k, 3, seed) * 20) * s, w = 3.5 * s;
      const ux = Math.cos(r), uy = Math.sin(r);
      z5Tri(x - ux * L * 0.5 - uy * w, y - uy * L * 0.5 + ux * w, x - ux * L * 0.5 + uy * w, y - uy * L * 0.5 - ux * w, x + ux * L * 0.5, y + uy * L * 0.5, 96);
      lineP(x - ux * L * 0.5, y - uy * L * 0.5, x + ux * L * 0.5, y + uy * L * 0.5, 103);
    }
  }
  // the sky as the light comes back after the black sun: a little darker behind the fight, so the bodies read
  function b4Return(t, hz, ox, dk) {
    b4Sky(t, H - LB, 0, 0, 0, 0);
    cloudBank(hz, 24, 70, 5051, (ox || 0) + t * 10, CLOUD_SUN, false);
    cloudBank(hz + 24, 30, 50, 5052, (ox || 0) * 1.4 + t * 14, [17, 18, 19, 15], false);
    z5GodRays(80, 30, 8, t * 0.4, T_WARM, 0.22, 520);
    tintAll(T_DARK, (dk === undefined ? 0.3 : dk) + 0.08);
  }
  // his reaction to a cut g seconds after it: nothing while the contact holds, then the knock (a function of g)
  const b4Rx = (g, amp, w, d) => g < B4_STOP ? 0 : z5Knock(g - B4_STOP, amp, w || 9, d || 4);
  const b4Shud = (g, t) => g >= 0 && g < B4_STOP ? z5Sh(t, 7) * 2.5 : 0;
  // his surviving upper-right arm: never still; jolted by each cut
  const b4UR = (t, g, jx, jy, base) => { const [dx, dy] = b4Idle(t, 1, 5); return { x: (base ? base[0] : 140) + dx + b4Rx(g, jx), y: (base ? base[1] : 104) + dy + b4Rx(g, jy), pose: g >= 0 && g < 0.5 ? b4Pose('fist', 'claw', Math.sin(Math.min(1, g * 3) * PI)) : b4Flex(t, 1, 'fist') }; };
  // 1 — the dive (140.0): his upper-left hand swipes at it, and it comes down along its blade through that arm at the shoulder
  const B4_K1 = K({ t: 0, x: 40, y: 236, sw: -0.7 }, { t: 0.22, x: 96, y: 58, sw: -2.4, e: 'o' }, { t: 0.4, x: 144, y: 120, sw: 1.0, e: EQ }, { t: 0.75, x: 286, y: 236, sw: 2.0, e: 'o' });
  shot(139.6, 140.3, (lt, t) => {
    const tc = 0.4, g = lt - tc;
    b4Return(t, 214, 260, 0.34);
    const CX = 318, CY = 104, s = 1.5;
    const sw_ = eio(b4Clip(0.05, 0.32, lt));
    const ulA = b4Reach(0, lerp(-132, -176, sw_), lerp(110, 28, sw_)), ul = { x: ulA[0], y: ulA[1], pose: b4Pose('fist', 'claw', sw_), ang: lerp(1.9, -2.7, sw_) };
    const R_ = b4SundC(CX, CY, s, t, { ul, ur: b4UR(t, g, 10, -8), roar: g > 0 ? 0.7 : 0.15 + 0.2 * sw_, eyes: 1.6 + 0.4 * sw_, lean: -6 * sw_ + b4Rx(g, 12), tilt: -0.06 * sw_ + b4Rx(g, 0.1), nod: b4Rx(g, 4), shake: g > 0 && g < 0.6 ? 0.5 : 0 });
    const shA = [CX + (SH4[0][0] + R_.lean * 0.85) * s, CY + Math.sin(t * 0.9) * s + SH4[0][1] * s];
    if (g > 0) { const tg = Math.max(0, g - B4_STOP), wr = [CX + ul.x * s, CY + Math.sin(140.0 * 0.9) * s + ul.y * s], el = b4Elbow(shA[0], shA[1], wr[0], wr[1], s, 0); b4Limb(shA[0], shA[1], el[0], el[1], wr[0], wr[1], s, tg, -230, -150, -5, 'claw', 0, t); }
    const F = b4Fighter(B4_K1, lt, t, 1.5, 170, 4, null, tc);
    if (g >= 0) { const [px, py] = b4OnBlade(F.hand, F.p.sw, shA); b4Cut(px, py, g, F.p.sw, 2711, 1); }
    const [kz, kr, kx, ky] = kick(lt, [[tc + B4_STOP, 2, 1.0]]);
    z5Cam(1.04 + kz, kr, 250 - kx, 140 - ky, 240, 135);
  });
  // 2 — overhead and across (140.6): the blade sweeps over him from the right and takes the crown
  const B4_K2 = K({ t: 0, x: 470, y: 70, sw: -0.4 }, { t: 0.16, x: 420, y: 58, sw: -0.9, e: 'o' }, { t: 0.3, x: 330, y: 92, sw: -3.47, e: EQ }, { t: 0.6, x: 90, y: 118, sw: -4.0, e: 'o' });
  shot(140.3, 140.9, (lt, t) => {
    const tc = 0.3, g = lt - tc;
    b4Return(t, 230, 300, 0.32);
    const CX = 250, CY = 204, s = 1.8;
    const R_ = b4SundC(CX, CY, s, t, { ur: b4UR(t, g, 6, 14), roar: 0.5 + (g > 0 ? 0.3 : 0), eyes: g > 0 && g < 0.4 ? 2 : 1.6, nod: b4Rx(g, 7), tilt: -0.05 + b4Rx(g, 0.08), lean: b4Rx(g, -8), shake: g > 0 && g < 0.5 ? 0.4 : 0 });
    const T = [CX + R_.lean * s * 0.95, CY - 46 * s];
    b4CrownShards(CX + R_.lean * s, CY - 4 * s, g - B4_STOP, 2721);
    const F = b4Fighter(B4_K2, lt, t, 1.5, 150, 4, null, tc);
    if (g >= 0) { const [px, py] = b4OnBlade(F.hand, F.p.sw, T); b4Cut(px, py, g, F.p.sw, 2722, 0.9); }
    const [kz, kr, kx, ky] = kick(lt, [[tc + B4_STOP, 2, -PI / 2]]);
    z5Cam(1.0 + kz, kr, 250 - kx, 140 - ky, 240, 135);
  });
  // 3 — down across the chest, through the lower-left stump (141.2)
  const B4_K3 = K({ t: 0, x: 30, y: 40, sw: -1.6 }, { t: 0.15, x: 52, y: 70, sw: -2.5, e: 'o' }, { t: 0.3, x: 67, y: 181, sw: 0.54, e: EQ }, { t: 0.6, x: 430, y: 236, sw: 1.1, e: 'o' });
  shot(140.9, 141.5, (lt, t) => {
    const tc = 0.3, g = lt - tc;
    b4Return(t, 250, 340, 0.36);
    const CX = 222, CY = 56, s = 1.6;
    const R_ = b4SundC(CX, CY, s, t, { ur: b4UR(t, g, 14, 10), roar: 0.8, eyes: 1.8, tilt: b4Rx(g, -0.1), lean: b4Rx(g, 10), nod: b4Rx(g, 5), shake: g > 0 && g < 0.6 ? 0.5 : 0 });
    const by = CY + Math.sin(t * 0.9) * s, T = [CX + (SH4[2][0] + R_.lean * 0.6) * s, by + SH4[2][1] * s];
    if (g > 0) { const tg = Math.max(0, g - B4_STOP), wr = [CX + B4_LOW[0].x * s, by + B4_LOW[0].y * s], el = b4Elbow(T[0], T[1], wr[0], wr[1], s, 2); b4Limb(T[0], T[1], el[0], el[1], null, null, s, tg, -200, 60, 4, null, 2, t); }
    const F = b4Fighter(B4_K3, lt, t, 1.5, 190, 4, null, tc);
    if (g >= 0) { const [px, py] = b4OnBlade(F.hand, F.p.sw, T); b4Cut(px, py, g, F.p.sw, 2731, 1); }
    const [kz, kr, kx, ky] = kick(lt, [[tc + B4_STOP, 2, 0.54]]);
    z5Cam(1.0 + kz, kr, 240 - kx, 135 - ky, 240, 135);
  });
  // 4 — straight down through his face (141.8): half the mask falls away
  const B4_K4 = K({ t: 0, x: 468, y: 60, sw: -0.6 }, { t: 0.15, x: 420, y: 40, sw: -1.4, e: 'o' }, { t: 0.3, x: 242, y: 54, sw: 1.93, e: EQ }, { t: 0.7, x: 110, y: 236, sw: 2.3, e: 'o' });
  shot(141.5, 142.2, (lt, t) => {
    const tc = 0.3, g = lt - tc;
    b4Return(t, 260, 380, 0.4);
    const CX = 240, CY = 142, s = 3.0, o = { ur: b4UR(t, g, 8, 8), roar: 0.4 + (g > 0 ? 0.5 : 0), eyes: 1.8, tilt: b4Rx(g, 0.14), nod: b4Rx(g, 3), lean: b4Rx(g, -5), shake: g > 0 && g < 0.5 ? 0.3 : 0 };
    const R_ = b4SundC(CX, CY, s, t, o);
    if (g > B4_STOP) { const tg = g - B4_STOP; b4MaskPart(CX, CY, s, t, Object.assign({ heat: 0.95, rage: 1, third: 1, eyes: 1.8, maskCuts: B4_MCUT }, o), -1, [-tg * 140, tg * 60 + tg * tg * 260], -tg * 2.2, R_.lean); }
    const T = [CX + R_.lean * s * 0.95, CY + Math.sin(t * 0.9) * s];
    const F = b4Fighter(B4_K4, lt, t, 1.6, 260, 5, null, tc);
    if (g >= 0) { const [px, py] = b4OnBlade(F.hand, F.p.sw, T); b4Cut(px, py, g, F.p.sw, 2741, 1.1); }
    const [kz, kr, kx, ky] = kick(lt, [[tc + B4_STOP, 2.5, 2.0]]);
    z5Cam(1.0 + kz, kr, 240 - kx, 135 - ky, 240, 135);
  });
  // 5 — up from under (142.4): the last stump; he roars
  const B4_K5 = K({ t: 0, x: 470, y: 238, sw: 0.6 }, { t: 0.1, x: 440, y: 240, sw: 1.2, e: 'o' }, { t: 0.2, x: 384, y: 214, sw: -3.06, e: EQ }, { t: 0.55, x: 300, y: 60, sw: -1.6, e: 'o' });
  shot(142.2, 142.75, (lt, t) => {
    const tc = 0.2, g = lt - tc;
    b4Return(t, 240, 420, 0.38);
    const CX = 250, CY = 76, s = 1.4;
    const R_ = b4SundC(CX, CY, s, t, { ur: b4UR(t, g, -10, -18, [150, 96]), roar: g > 0 ? 1 : 0.4, eyes: 2, nod: -5 * Math.min(1, Math.max(0, g - B4_STOP) * 4), lean: b4Rx(g, -9), tilt: b4Rx(g, -0.08), shake: g > 0 ? 0.6 : 0 });
    const by = CY + Math.sin(t * 0.9) * s, T = [CX + (SH4[3][0] + R_.lean * 0.6) * s, by + SH4[3][1] * s];
    if (g > 0) { const tg = Math.max(0, g - B4_STOP), wr = [CX + B4_LOW[1].x * s, by + B4_LOW[1].y * s], el = b4Elbow(T[0], T[1], wr[0], wr[1], s, 3); b4Limb(T[0], T[1], el[0], el[1], null, null, s, tg, 90, -230, 5, null, 3, t); }
    const F = b4Fighter(B4_K5, lt, t, 1.5, 170, 4, null, tc);
    if (g >= 0) { const [px, py] = b4OnBlade(F.hand, F.p.sw, T); b4Cut(px, py, g, F.p.sw, 2751, 1); }
    const [kz, kr, kx, ky] = kick(lt, [[tc + B4_STOP, 2, -1.2]]);
    z5Cam(1.02 + kz, kr, 250 - kx, 140 - ky, 240, 135);
  });

  /* ================================================================ V.15 — his last fist (142.75–144.1) */
  // the fist: drawn back with his whole body, then thrown with everything he has left; its knuckles stop dead on the point
  // of the blade (143.4), the gauntlet breaks from the knuckles back, the arm is driven back and he reels
  shot(142.75, 144.1, (lt, t) => {
    const T0 = 142.75, hc = 143.4 - T0, g = lt - hc;
    b4Return(t, 226, 460, 0.45);
    const CX = 330, CY = 104, s = 1.3, contact = [242, 140];
    const cock = eio(b4Clip(0, 0.4, lt)), thr = eic(b4Clip(0.4, hc, lt)), rec = g > 0 ? eoc(b4Clip(0.05, 0.6, g)) : 0;
    // the wrist that lands the knuckles on the point (the hand pointing straight at it)
    const bob = Math.sin(t * 0.9) * s, kn = 10.8 * s;
    const wC = [(contact[0] + kn - CX) / s, (contact[1] - CY - bob) / s];
    const wBack = [82, 14];
    const wx = lerp(lerp(140, wBack[0], cock), wC[0], thr) + rec * 46 + b4Rx(g + B4_STOP, 10), wy = lerp(lerp(104, wBack[1], cock), wC[1], thr) + rec * 14 - Math.sin(thr * PI) * 18;
    const shud = g > 0 && g < 0.25 ? z5Sh(t, 7) * 2.5 * (1 - g / 0.25) : 0;
    const lean = 10 * cock * (1 - thr) - 12 * thr * (1 - rec) + 8 * rec + b4Rx(g + B4_STOP, 6);
    const R_ = b4SundC(CX + shud, CY, s, t, { ur: { x: wx, y: wy, pose: g > 0.3 ? b4Pose('fist', 'claw', b4Clip(0.3, 0.8, g)) : 'fist', ang: lerp(-0.2, PI, eio(b4Clip(0.25, hc, lt))), heat: 1, front: true }, roar: 1, eyes: 2, nod: -3 * cock + 5 * thr * (1 - rec), tilt: -0.08 * thr + b4Rx(g + B4_STOP, 0.12), lean });
    const fist = R_.hands[1];
    // the gauntlet breaks from the knuckles back
    if (g > 0) { rocks(fist[0] + 6, fist[1], g, 30, 220, 3.5, [67, 66, 65, 64], 2761, 140, -0.2, 2.4); rocks(contact[0], contact[1], g, 16, 160, 2, [103, 105, 107, 22], 2762, 100, 0.3, 2); }
    // the hero, blade levelled at him, braced; driven back by the blow (squashed along it), then drives on
    const kb = z5Knock(g, 14, 9, 4);
    const HX = 112 - kb + 14 * eio(b4Clip(0.3, 1.2, g)) - 6 * cock + z5N(t, 3) * 2, HY = 142 + z5Sh(t, 2) * (g > 0 ? 1 : 0.4) + Math.sin(t * 2.4) * 2 * (1 - thr);
    const a = -0.02 + z5Knock(g, 0.08, 10, 4);
    const hero = b4Inf(HX, HY, 1.9, t, { sw: a, spread: 1, flap: 0.34, wt: t * 3, orbR: 30, orbA: 1.6, auraR: 7, noLife: true, mouth: 2, eyes: g > 0 && g < 0.3 ? 'wide' : 'glow', warp: 0.2, sq: Math.max(0, kb) * 0.02, rays: g > 0 && g < 0.5 ? 60 : 0 });
    // the blade's point is exactly where the knuckles land; after the hit it drives on into the broken fist
    const tipX = g > 0 ? Math.min(fist[0] - 4, contact[0] + 40 * eio(b4Clip(0.2, 1, g))) : contact[0];
    bigBlade(hero.hand[0], hero.hand[1], a, Math.max(10, tipX - hero.hand[0]), 5, t, { form: 'infinite', flare: 0.8, surge: true });
    if (g >= 0) { megaHit(contact[0], contact[1], g, 3, PI, [22, 85, 83], 2763); b4Inv(contact[0], contact[1], 18 * Math.exp(-g * 2.5), 2764); }
    if (g < 0) { glow(contact[0], contact[1], 30 * thr, T_WH, 0.25 * thr); }
    const [kz, kr, kx] = kick(lt, [[hc, 3, 0]]);
    z5Cam(1.04 + 0.1 * thr + kz, kr, 250 + kx, 138, 240, 135);
  });

  /* ================================================================ V.16 — raised over the world (144.1–145.0) */
  // under it, looking up: it rises into the returning light, and the Worldblade grows back to its whole length overhead
  shot(144.1, 144.75, (lt, t) => {
    const u = eio(lt / 0.65);
    b4Sky(t, H - LB, 240, 60, 0, 0);
    z5GodRays(240, 40, 10, t * 0.6, T_WARM, 0.6, 520);
    tintAll(T_DARK, 0.4 - 0.25 * u);
    glow(240, 40, 220, T_WH, 0.3 + 0.2 * u);
    const HX = 240, HY = lerp(170, 96, eoc(lt / 0.6)), a = lerp(-1.0, -1.62, u);
    const hero = b4Inf(HX, HY, 2.4, t, { sw: a, spread: 1, flap: 0.3, wt: t * 2.4, orbR: 60, orbA: 2, auraR: 9, noLife: true, mouth: 2, eyes: 'glow', warp: 0.5, rays: 160, over: 0.3 * u });
    bigBlade(hero.hand[0], hero.hand[1], a, 200 + 1200 * u, 4 + 3 * u, t, { form: 'infinite', flare: 1, grow: 0.5 + 0.5 * u, surge: true });
    shk(2 + 3 * u);
    z5Cam(1.1 - 0.1 * u, -0.04 * u, 240, 135, 240, 135);
  });

  /* ================================================================ V.17 — THE FINAL CUT (144.75–146.6) */
  // wide: it swings the whole Worldblade over and down, crown to base, and the cut runs on through the clouds, the sea
  // and the horizon: the whole world split along one line, as he once split it
  const B4_FA = PI / 2 - 0.1;
  const B4_FX = 250, B4_FY = 154, B4_FS = 1.4;
  function b4WorldWide(t, dk) {
    b4Sky(t, 150, 0, 0, 0, 0);
    // the cloud sea to the horizon
    cloudBank(150, 10, 90, 5061, t * 4, [17, 18, 19, 20], false);
    cloudBank(176, 18, 70, 5051, t * 8, CLOUD_SUN, false);
    cloudBank(206, 26, 60, 5052, t * 12, [17, 18, 19, 15], false);
    if (dk > 0) tintAll(T_DARK, dk);
  }
  shot(144.75, 146.6, (lt, t) => {
    const tc = 0.25, g = lt - tc, gs = Math.max(0, g - B4_STOP);
    b4WorldWide(t, 0.35 - 0.15 * eio(b4Clip(0, 1.8, lt)));
    z5GodRays(B4_FX - 6, 40, 10, t * 0.5, T_WARM, 0.45, 500);
    // the cut runs through him from the crown down (local units along the split line), after the held contact
    const run = g < B4_STOP ? 0 : eoc(b4Clip(0, 0.4, gs)), ux = Math.cos(B4_FA), uy = Math.sin(B4_FA);
    const wounds = g > 0 ? [[ux * -70, uy * -70, ux * (-70 + 460 * run), uy * (-70 + 460 * run), 2 + 2 * run]] : [];
    const maskCuts = (g > 0 ? [[-ux * 28, -uy * 28, ux * 28, uy * 28, Math.max(0.15, run * 1.4)]] : []).concat(B4_MCUT);
    // he sees it coming (looks up, the arm comes up to ward it off), is struck rigid, then the blow drives his head down
    const look = eio(b4Clip(0, tc, lt)), sh = b4Shud(g, t);
    const ur = b4Reach(1, lerp(140, 70, look) + b4Rx(g, 30), lerp(100, -40, look) + b4Rx(g, -20), 138);
    const R_ = b4SundC(B4_FX + sh, B4_FY, B4_FS, t, { ur: { x: ur[0], y: ur[1], pose: g > B4_STOP ? b4Pose('claw', 'open', b4Clip(0, 0.3, gs)) : b4Pose('fist', 'claw', look), ang: -1.2 }, wounds, maskCuts, roar: g > 0 ? 0.9 : 0.3 + 0.3 * look, eyes: g > 0 ? 2.1 : 1.6 + 0.3 * look, nod: -4 * look * (g > 0 ? 0 : 1) + b4Rx(g, 6), tilt: b4Rx(g, 0.06), lean: b4Rx(g, -4), shake: g > 0 ? 0.6 * Math.exp(-gs * 1.5) : 0 });
    // the cloud closes over his base in front
    cloudBank(250, 16, 60, 5053, t * 16, [17, 18, 19, 15], false);
    // the hero high over his crown, the blade swung over from behind it to straight down; it holds on the contact
    const tt = g > 0 ? Math.min(lt, tc) + gs : lt, HY = 62 - 4 * Math.min(1, gs * 3) + b4Rx(g, -5), HX = 222;
    const a = tt < tc ? lerp(PI + 0.7, B4_FA, eic(tt / tc)) : B4_FA;
    const hero = b4Inf(HX, HY, 1.3, t, { sw: a, spread: 1, flap: 0.3, wt: t * 2.6, orbR: 18, orbA: 1.6, auraR: 4, noLife: true, mouth: 2, eyes: 'glow', warp: 0.2, rays: g > 0 ? 50 : 0, sq: g > 0 && g < B4_STOP ? 0.12 : 0 });
    if (tt < tc + 0.15) { const a0 = lerp(PI + 0.7, B4_FA, eic(clamp(tt - 0.12, 0, tc) / tc)); b4Arc(hero.hand[0], hero.hand[1], a0, a - a0, 300, tt < tc ? 0 : (tt - tc) / 0.15); }
    bigBlade(hero.hand[0], hero.hand[1], a, 900, 4, t, { form: 'infinite', flare: 1, surge: true });
    const crown = [B4_FX + R_.lean * B4_FS * 0.95, B4_FY - 40 * B4_FS];
    // the split runs out from where it struck him, both ways along the line, and the two halves of the world part
    if (g >= 0) {
      const [px, py] = b4OnBlade(hero.hand, a, crown);
      b4Cut(px, py, g, a, 2801, 1.6);
      if (g > B4_STOP) { const amt = eoc(b4Clip(0, 0.5, gs)), gap = 3 + 27 * eoc(b4Clip(0.05, 1.4, gs)); worldSplit(B4_FX, B4_FY + 20, B4_FA, gap, amt, t); glow(B4_FX, B4_FY, 120, T_WH, 0.4 * Math.exp(-gs * 2)); shockRing(B4_FX, B4_FY + 40, 10 + gs * 600, 4 + gs * 80, 3, [22, 21, 20], 1 - gs / 0.8); shk(8 * Math.exp(-gs * 3)); }
    }
    const [kz, kr] = kick(lt, [[tc, 2], [tc + B4_STOP, 4, PI / 2]]);
    z5Cam(1.0 + kz - 0.04 * eio(b4Clip(tc, 1.8, lt)), kr, 250, 122, 240, 135);
  });

  /* ================================================================ V.18 — he comes apart; "...brother..." (146.6–150.0) */
  // he comes apart along the cut, the halves sliding, fire dripping from the faces of it; his last hand reaches up into the
  // light, trembling, for something that is not there, and slowly closes on nothing
  shot(146.6, 150.0, (lt, t) => {
    const u = lt / 3.4, spl = eio(b4Clip(0.1, 3.4, lt)) * 0.75;
    b4WorldWide(t, 0.25);
    worldSplit(240, 140, B4_FA, 34 + 10 * u, 1, t);
    const CX = 240, CY = 118, s = 1.9;
    const eyes = lerp(1.6, 0.25, eio(b4Clip(1.0, 3.2, lt))), third = 1 - eio(b4Clip(1.9, 3.0, lt));
    const reach = eio(b4Clip(0.3, 2.0, lt)), close = eio(b4Clip(2.3, 3.3, lt)), tr = (1 + 2 * reach) * z5Sh(t, 5);
    const [ix, iy] = b4Idle(t, 1, 3), ur = b4Reach(1, lerp(140, 30, reach) + ix + tr, lerp(124, -50, reach) + iy + tr * 0.5, 136);
    b4SundC(CX, CY, s, t, { ur: { x: ur[0], y: ur[1], pose: b4Pose(b4Pose('claw', 'open', reach), 'grab', close), ang: lerp(-0.4, -1.75, reach), heat: lerp(0.8, 0.35, u) }, split: spl, splitA: B4_FA, splitX: 0, splitY: 0, eyes, third, roar: t > 147.0 && t < 148.2 ? 0.25 + 0.15 * Math.sin(t * 9) : 0.1, heat: lerp(0.95, 0.4, u), rage: lerp(1, 0.2, u), nod: 4 * u - 3 * reach * (1 - u), tilt: -0.08 * reach + 0.03 * Math.sin(t * 0.7) });
    // fire dripping off both faces of the cut
    const ux = Math.cos(B4_FA), uy = Math.sin(B4_FA), sux = ux, suy = uy;
    for (const sd of [-1, 1]) {
      const ox = (-suy * sd * spl * 40 + sux * sd * spl * 10) * s, oy = (sux * sd * spl * 40 + suy * sd * spl * 10 + spl * spl * 30) * s;
      for (let k = 0; k < 9; k++) {
        const along = (-40 + k * 26 + ih(k, sd + 2, 2812) * 10) * s, f = frac(t * (0.6 + ih(k, sd + 4, 2812) * 0.5) + ih(k, sd + 6, 2812));
        const x = CX + ux * along + ox + uy * sd * 2, y = CY + uy * along + oy + f * f * 60;
        if (y < LB || y > H - LB) continue;
        rectF(x, y, 1 + (f < 0.3 ? 1 : 0), 2 + fl(3 * (1 - f)), f < 0.4 ? 105 : 103);
      }
    }
    // light pouring from the cut, embers and ash lifting off him already
    for (let k = 0; k < 50; k++) { const f = frac(ih(k, 1, 2811) + t * 0.35), x = CX + (ih(k, 2, 2811) - 0.5) * 300 * (0.3 + f), y = CY + 150 - f * 260 + ih(k, 3, 2811) * 40; if (bay(fl(x), fl(y)) < 1 - f) rectF(x, y, 2, 2, k % 3 ? 121 : 104); }
    shk(0.6 + 1.5 * u);
    z5Cam(1.04 + 0.08 * eio(u), 0.004 * z5N(t, 1), 240, 130, 240, 135);
  });
  CAPS.push([147.0, 149.6, 's', 'SUNDERER', '...BROTHER...']);

  /* ================================================================ VI.1 — he bursts into ash (150.0–153.0) */
  shot(150.0, 153.0, (lt, t) => {
    const g = lt;
    b4WorldWide(t, 0.25 + 0.25 * eio(b4Clip(0.4, 3, lt)));
    worldSplit(B4_FX, B4_FY + 20, B4_FA, 30 * (1 - eio(b4Clip(0.3, 3, lt))), 1, t);
    // the last of him: a white silhouette for an instant, then gone into shards and ash
    if (g < 0.12) { b4SundC(B4_FX, B4_FY, B4_FS, t, { ur: { x: 140, y: 140, pose: 'open' }, split: 0.75, splitA: B4_FA, eyes: 0.2, third: 0, heat: 0.4 }); for (let y = LB; y < H - LB; y++) for (let x = 120; x < 400; x++) { const i = y * W + x; if (BUF[i] >= 96 && BUF[i] <= 107 || (BUF[i] >= 64 && BUF[i] <= 69)) BUF[i] = 22; } }
    rocks(B4_FX, B4_FY + 40, g, 40, 220, 5, [96, 98, 100, 105], 2821, 40);
    rocks(B4_FX, B4_FY, g, 24, 300, 3, [103, 105, 107, 22], 2822, 20);
    rocks(B4_FX, B4_FY - 10, g, 14, 160, 4, [67, 66, 65, 64], 2823, 60);
    // a cloud of ash and cinder where he stood, swelling, thinning
    { const R = 30 + 150 * eoc(g / 2.2), th = sstep(0.4, 3, g); for (let y = Math.max(LB, fl(B4_FY - R)); y < Math.min(H - LB, B4_FY + 40 + R * 0.6); y++) for (let x = Math.max(0, fl(B4_FX - R * 1.3)); x < Math.min(W, B4_FX + R * 1.3); x++) { const dx = (x - B4_FX) / (R * 1.3), dy = (y - B4_FY - 20) / R, d = Math.sqrt(dx * dx + dy * dy) + (vn(x + t * 10, y - t * 6, 9, 2825) - 0.5) * 0.5; if (d > 1 || bay(x, y) < th + d * 0.5) continue; BUF[y * W + x] = d < 0.25 && g < 0.45 ? 107 : ASH[clamp(fl((1 - d) * 2.4 + vn(x, y, 5, 2826) * 1.2), 0, 3)]; } }
    // ash: a cloud of it thrown out, slowing, then drifting down
    for (let k = 0; k < 260; k++) {
      const a = ih(k, 1, 2824) * TAU, v = 30 + ih(k, 2, 2824) * 190, d = v * (1 - Math.exp(-g * 2.2)) / 2.2;
      const x = B4_FX + Math.cos(a) * d * 1.3 + Math.sin(t * 0.7 + k) * 3, y = B4_FY + 20 + Math.sin(a) * d * 0.8 + g * g * 4 + g * 6;
      if (ih(k, 3, 2824) < g * 0.12) continue;
      rectF(x, y, 1 + (k % 3 === 0 ? 1 : 0), 1 + (k % 3 === 0 ? 1 : 0), g < 0.5 && k % 4 === 0 ? 105 : ASH[k % 4]);
    }
    // the shockwave of light across the sky and the cloud sea
    shockRing(B4_FX, B4_FY, 10 + g * 520, 10 + g * 520, 5, [22, 16, 15], 1 - g / 1.2);
    shockRing(B4_FX, 190, 10 + g * 700, 4 + g * 70, 4, [22, 21, 20], 1 - g / 1.6);
    glow(B4_FX, B4_FY, 60 + 260 * eoc(g / 1.5), T_WH, 0.6 * Math.exp(-g * 1.4));
    if (g < 0.03) impactFrame(B4_FX, B4_FY, 0);
    shk(8 * Math.exp(-g * 2.5));
    // the hero above, alone, the blade still down
    const fall = eio(b4Clip(1.6, 3, lt));
    const hero = b4Inf(222, 62 + z5Knock(g, -8, 6, 3) + 6 * fall, 1.3, t, { sw: B4_FA - 0.4 * fall, spread: 1 - 0.3 * fall, flap: 0.22, wt: t * 2, orbR: 22, orbA: 2 - 0.6 * fall, auraR: 5, noLife: true, mouth: 0, eyes: lt > 1.6 ? 'narrow' : 'glow', warp: 0.2 });
    bigBlade(hero.hand[0], hero.hand[1], B4_FA - 0.4 * fall, lerp(900, 180, fall), 4, t, { form: 'infinite', flare: 0.8 });
    z5Cam(1.0 + kick(lt, [[0, 3]])[0] - 0.04 * eio(lt / 3), 0, 250, 122, 240, 135);
  });

  /* ================================================================ VI.2 — what it cost (153.0–158.0) */
  // silence and falling ash; the Infinite form drains out of it, the Worldblade shrinks back to a sword and crumbles to
  // its hilt, and it falls
  const B4_ASHF = (t, n, seed, sp) => { for (let k = 0; k < n; k++) { const x = ((ih(k, 1, seed) * 520 + Math.sin(t * 0.5 + k) * 12 - t * 4) % 520 + 520) % 520 - 20, y = LB + ((ih(k, 2, seed) * 230 + t * (8 + ih(k, 3, seed) * 10) * sp) % 230), big = k % 3 === 0; rectF(x, y, big ? 2 : 1, big ? 2 : 1, big ? 123 : ASH[1 + (k * 7) % 3]); if (big) P(x + 1, y + 1, 121); } };
  shot(153.0, 158.0, (lt, t) => {
    const drain = eio(b4Clip(0.2, 2.2, lt)), coral = lt > 1.7, fall = eic(b4Clip(3.0, 5.0, lt));
    // an ashen sky with no sun in it: a dim band of light low down where the dawn should be, the cloud sea in layers below,
    // pale shafts through the ash, the ash itself falling at three depths
    const hz = 196 - 60 * fall;
    gradient(LB, hz + 6, [1, 96, 120, 121, 17, 18]);
    glow(150, hz, 220, T_WARM, 0.12);
    z5GodRays(70, LB - 10, 6, t * 0.08, T_WH, 0.1, 360);
    cloudBank(hz + 4, 12, 90, 5061, t * 2, [120, 121, 17, 18], false);
    cloudBank(hz + 22, 22, 70, 5051, t * 4, [17, 120, 121, 18], false);
    cloudBank(hz + 50, 30, 55, 5052, t * 7, [96, 120, 121, 17], false);
    tintAll(T_DARK, 0.3);
    for (let k = 0; k < 10; k++) { const f = frac(ih(k, 1, 2835) + t * (0.05 + ih(k, 2, 2835) * 0.04)), x = ((ih(k, 3, 2835) * 520 + Math.sin(t * 0.6 + k) * 16 - t * 9) % 520 + 520) % 520 - 20, y = LB + f * (H - 2 * LB); rectF(x, y, 3, 2, 121); P(x + 1, y, 123); }
    B4_ASHF(t, 140, 2831, 1);
    const HX = 236 + z5N(t * 0.4, 1) * 2 + 8 * fall, HY = 118 + 30 * fall + Math.sin(t * 1.2) * 2 * (1 - fall), S = 3.2;
    const ang = 0.05 + 1.2 * fall * fall + Math.sin(t * 0.8) * 0.03;
    // the blade: a Worldblade's worth of light pulled back into the hilt; then just a sword; then it crumbles
    const bl = lt < 1.4 ? lerp(320, 30, eio(lt / 1.4)) : 30, crumble = eio(b4Clip(2.2, 3.2, lt));
    const swl = lt < 1.4 ? 9 : lerp(30, 8, crumble), sw = lerp(-0.5, 0.6, drain) + fall * 0.8;
    if (!coral) {
      const DF = ['infinite', 'lastlight', 'nova', 'zenith', 'storm', undefined], fi = clamp(fl(b4Clip(0.35, 1.7, lt) * 6), 0, 5);
      const r = b4Inf(HX, HY, S, t, { form: DF[fi], sw, ang, spread: 1 - drain, flap: 0.12, wt: t * 1.2, orbR: 60 * (1 - drain * 0.5), orbA: lerp(2, 0.2, drain), auraR: lerp(9, 2, drain), noLife: true, eyes: drain > 0.7 ? 'narrow' : 'glow', warp: 0.2 * (1 - drain), cracks: 0.3 + 0.5 * drain });
      if (lt < 1.4) bigBlade(r.hand[0], r.hand[1], sw + ang, bl * S / 3.2 * 3, 3 * (1 - drain * 0.5), t, { form: 'infinite', flare: 0.5 * (1 - drain), grow: 0.5 });
      if (lt > 1.4) for (let k = 0; k < 6; k++) { const g = lt - 1.4 - k * 0.04; if (g > 0 && g < 0.3) sparkle(r.hand[0] + Math.cos(sw + ang) * 30 * S * k / 6, r.hand[1] + Math.sin(sw + ang) * 30 * S * k / 6, 3, 22, PRISM[k]); }
    } else {
      const r = b4Hero({ eyes: lt < 2.6 ? 'narrow' : 'closed', sword: sw, cracks: 0.85, legs: z5Limp(t, 1.4), sq: 0.05 }, HX, HY, S, ang, false, { still: true }, swl, crumble > 0.05, crumble < 0.5 ? z5Sw(t * 0.2) : null);
      b4TintSprite(T_DARK, 0.25 + 0.2 * fall);
      if (lt < 1.95) { glow(HX, HY, 60, T_WH, 0.5 * (1 - (lt - 1.7) / 0.25)); for (let k = 0; k < 16; k++) { const a = ih(k, 1, 2832) * TAU, d = (lt - 1.7) * 160; P(HX + Math.cos(a) * d, HY + Math.sin(a) * d * 0.7, PRISM[k % 7]); } }
      // the blade crumbling: flakes of it falling away
      if (crumble > 0 && crumble < 1) rocks(r.tip[0], r.tip[1], (lt - 2.2) % 0.5, 6, 30, 1.6, [93, 94, 95, 34], 2833 + fl((lt - 2.2) / 0.5), 120, PI / 2, 2);
      // its four sparks, nearly out, hanging round it
      for (let k = 0; k < 4; k++) { const a = t * 0.8 + k * TAU / 4; if (ih(k, fl(t * 8), 2834) < 0.6) b4Ember(HX + Math.cos(a) * 34, HY + Math.sin(a) * 10, k, 0.2, t); }
    }
    z5Cam(1.1 + 0.08 * eio(lt / 5), 0.004 * z5N(t * 0.5, 2), HX, lerp(HY, 140, fall * 0.6), 240, 135);
  });

  /* ================================================================ VI.3 — the sun is reborn (158.0–162.0) */
  shot(158.0, 162.0, (lt, t) => {
    const born = eio(b4Clip(0, 2.6, lt)), SX = 330, SY = lerp(196, 168, eoc(b4Clip(0.2, 4, lt)));
    // dawn returns: from grey and ash to the morning
    z5Mix(born, () => { gradient(LB, 196, [17, 120, 121, 18, 19, 18]); cloudBank(204, 22, 80, 5051, t * 6, [17, 18, 19, 20], false); cloudBank(240, 30, 60, 5052, t * 9, [17, 18, 19, 20], false); }, () => { z5Dawn(t, 196, t * 8, SX, SY); });
    // the light gathers into a point, and the sun opens out of it
    const pt = eoc(b4Clip(0, 0.8, lt));
    if (born < 1) { glow(SX, SY, 30 + 120 * born, T_WARM, 0.7 * pt); sparkle(SX, SY, 4 + 16 * pt * (1 - born), 22, 16); }
    if (born > 0.3) z5GodRays(SX, SY, 7, t * 0.15, T_WARM, 0.5 * born, 400);
    // ash still coming down, thinning
    B4_ASHF(t, fl(70 * (1 - born * 0.7)), 2841, 1);
    // the hero far off, falling, slowing; the dawn reaches it and it hangs there over the cloud
    const sl = eoc(b4Clip(0, 3.4, lt)), HX = 168 + 10 * sl, HY = lerp(60, 150, sl) + Math.sin(t * 1.2) * 2 * sl;
    b4Hero({ eyes: 'closed', sword: 0.9 - 0.5 * sl, cracks: 0.85, legs: z5Limp(t, 1.2) }, HX, HY, 1.4, lerp(1.2, 0.25, sl), false, { still: true }, 8, true);
    b4TintSprite(T_DARK, 0.4 - 0.3 * born);
    z5Cam(1.0 + 0.03 * born, 0, 240, 135, 240, 135);
  });

  /* ================================================================ VI.4 — still here (162.0–171.0) */
  // it floats limp over the healed cloud sea: never still — it drifts on the air, turns slowly, breathes (shallow, then a
  // longer breath when it wakes), its limbs and the broken sword hang and sway; the four orbs come back as sparks one by
  // one, circling it on a tilted ring (behind it and in front), trailing light, twinkling, shedding motes, and drawing in
  // closer and brighter as it wakes and speaks
  const B4_SPARK = [163.0, 163.7, 164.4, 165.0];
  shot(162.0, 171.0, (lt, t) => {
    const SX = 352, SY = 170;
    z5Dawn(t, 192, t * 6, SX, SY);
    z5GodRays(SX, SY, 7, t * 0.15, T_WARM, 0.45, 380);
    B4_ASHF(t, 16, 2851, 0.6);
    const wake = clamp((t - 165.5) / 1.5, 0, 1), speak = t > 166.0 && t < 169.4 ? 1 : 0;
    // breath: about one every 4 s, deeper once it is awake
    const breath = Math.sin(t * 1.55 - 0.6) * (0.6 + 0.4 * wake);
    const HX = 214 + z5N(t * 0.21, 1) * 7 + 3 * Math.sin(t * 0.37), HY = 132 + Math.sin(t * 0.9) * 3.2 + z5N(t * 0.3, 2) * 2 - breath * 0.8, S = 3.0;
    const rot = 0.16 + Math.sin(t * 0.45) * 0.06 + z5N(t * 0.25, 3) * 0.03 - 0.06 * eio(wake);
    const eyes = t < 165.5 ? 'closed' : t < 165.62 ? 'narrow' : t < 165.7 ? 'closed' : t > 169.6 && t < 169.72 ? 'closed' : 'narrow';
    // the four sparks: where each is on its ring at time tt (and whether it is in front of it)
    const ringR = lerp(72, 60, wake), sp = (k, tt) => { const a = tt * 0.75 + k * TAU / 4, z = Math.sin(a); return [HX + Math.cos(a) * ringR, HY - 12 + z * ringR * 0.36 + Math.sin(tt * 2 + k) * 3, z]; };
    const drawSpark = (k, front) => {
      const st = B4_SPARK[k]; if (t < st) return;
      const g = t - st, flick = g < 0.6 ? ih(k, fl(t * 14), 2852) < 0.55 : true;
      const [x, y, z] = sp(k, t); if ((z > 0) !== front || !flick) return;
      const lvl = Math.min(1, g / 1.5) * (0.6 + 0.25 * wake + 0.25 * speak * (0.5 + 0.5 * Math.sin(t * 5 + k))), dz = 0.75 + 0.25 * z;
      // its trail along the ring, dissolving
      for (let q = 1; q < 9; q++) { const [px, py] = sp(k, t - q * 0.05); if (bay(fl(px), fl(py)) < (1 - q / 9) * lvl) P(px, py, q < 3 ? ORB[k][2] : ORB[k][1]); }
      const R = (2.2 + 1.6 * lvl) * dz + 0.3 * Math.sin(t * 3 + k);
      glow(x, y, R * 7, EL_T[k], 0.4 + 0.3 * lvl); discF(x, y, R + 1, 63); discF(x, y, R, ORB[k][1]); discF(x - R * 0.3, y - R * 0.3, R * 0.55, ORB[k][2]); P(x - R * 0.4, y - R * 0.4, 22);
      if (g < 0.25) sparkle(x, y, 5 * (1 - g / 0.25), 22, ORB[k][2]);
      else if (ih(k, fl(t * 2.5), 2855) < 0.45) { const tw = frac(t * 2.5); sparkle(x, y, 6 * Math.sin(tw * PI) * lvl, 22, ORB[k][2]); }
      // motes shed as it goes, sinking and going out
      for (let q = 0; q < 4; q++) { const f = frac(t * 0.8 + q * 0.25 + k * 0.13), [mx, my] = sp(k, t - f * 1.2); if (bay(fl(mx), fl(my + f * 16)) < (1 - f) * lvl * 0.8) P(mx + Math.sin(f * 7 + q) * 2, my + f * 16, ORB[k][f < 0.5 ? 2 : 1]); }
    };
    for (let k = 0; k < 4; k++) drawSpark(k, false);
    glow(HX, HY, 50 + 8 * breath, T_WARM, 0.15 + 0.05 * breath + 0.06 * wake);
    b4Hero({ eyes, mouth: speak && fl(t * 6) % 3 === 0 ? 1 : 0, sword: 0.55 + Math.sin(t * 0.6) * 0.12 + z5N(t * 0.4, 5) * 0.05, cracks: 0.85, legs: z5Limp(t * 0.8, 1.1), sq: 0.04 + 0.035 * breath }, HX, HY, S, rot, false, { still: true }, 8, true);
    b4TintSprite(T_DARK, 0.18 - 0.05 * wake);
    // the dawn on it: its sun-side edge lit
    z5Rim(1, -0.4, 60, 1);
    for (let k = 0; k < 4; k++) drawSpark(k, true);
    z5Cam(1.05 + 0.12 * eio(b4Clip(162, 167, t)) - 0.1 * eio(b4Clip(168, 171, t)), 0.006 * z5N(t * 0.4, 3), lerp(240, HX, eio(b4Clip(162, 166, t))) + z5N(t * 0.2, 6) * 4, lerp(135, HY, eio(b4Clip(162, 166, t))) + z5N(t * 0.23, 7) * 3, 240, 135);
    tintAll(T_DARK, sstep(169.9, 170.95, t));
  });
  CAPS.push([166.0, 169.4, 's', 'HERO', '...STILL... HERE.']);

  /* ================================================================ VI.5 — the title (171.0–180.0) */
  shot(171.0, 180.0, (lt, t) => {
    rectF(0, 0, W, H, 63);
    stars(t, H, 120, 5331);
    const s1 = 'FABLE 5.5', sc = lt < 0.08 ? 7 : 6, w = textWidth(s1, sc), x0 = 240 - w / 2;
    text(s1, x0, 70 - (sc - 6) * 3, (i, j, k) => (j < 2 ? 22 : EL[k % 4][j < 5 ? 2 : 1]), sc, 0);
    if (lt < 0.1) flashWhite(0.8 * (1 - lt / 0.1));
    if (lt > 0.7) { const s2 = 'PART IV · THE SUNDERER'; text(s2, 240 - textWidth(s2, 2) / 2, 132, 59, 2, 0, fl((lt - 0.7) * 30)); }
    if (lt > 1.6) { const s3 = 'TO BE CONTINUED'; text(s3, 240 - textWidth(s3, 1) / 2, 162, 19, 1, undefined, fl((lt - 1.6) * 30)); }
    b4Hero({ eyes: lt > 3 && lt < 3.12 ? 'closed' : 'normal', sword: -1.0, cracks: 0.35 }, 240, 210, 1.4, 0, false, {}, 8, true, z5Sw(t * 0.3));
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
        text(tag, x0, y, who === 'SUNDERER' ? 104 : who === 'UNMAKER' ? 74 : who === 'NULL' ? 42 : 35, 1);
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
    lifeTick(t, S); SLIFE.n = 0;              // per-draw physics slots restart each frame (hero and villain)
    S.fn(t - S.t0, t);
    for (const [wt, dir] of WHIPS) { const d = Math.abs(t - wt); if (d < 0.1) whip(80 * (1 - d / 0.1), dir); }
    for (const c of FLASH_CUTS) if (t >= c && t < c + 0.067) tintAll(T_WH, 0.55);
    grade();
    shakePicture(t);
    letterbox(LB);
    if (S.post) S.post(t - S.t0, t);
    drawCaptions(t);
    SHX = 0; SHY = 0;                       // (the shake is applied to the picture inside the bars, in shakePicture)
  }
  // shake is a camera being knocked about, not static: smooth noise (a few wobbles a second) rather than a new random spot
  // every frame; only the picture moves, the letterbox bars stay put
  function shakePicture(t) {
    const f = fl(t * 30);
    const nz = (k) => Math.sin(t * 37.1 + k) * 0.55 + Math.sin(t * 59.3 + k * 2.3) * 0.3 + (ih(f, k, 901) - 0.5) * 0.3;
    const dx = Math.round(nz(1) * 1.6 * SHAKE_A), dy = Math.round(nz(2) * 1.6 * SHAKE_A);
    if (!dx && !dy) return;
    TMP.set(BUF);
    for (let y = LB; y < H - LB; y++) { const sy = clamp(y - dy, LB, H - LB - 1); for (let x = 0; x < W; x++) BUF[y * W + x] = TMP[sy * W + clamp(x - dx, 0, W - 1)]; }
  }

  /* ================================================================ grade: light that spills, and a darkened edge
     Bloom: bright pixels (emitters) are gathered into a coarse grid, blurred, and spilled back over their neighbourhood as a
     tint of their own hue (gold light spills gold, magenta spills magenta), only onto what is darker than the light itself.
     Vignette: the corners of the frame sink a little, to hold the eye in the middle. */
  const GC = 4, GW = W / GC, GH = Math.ceil(H / GC), GR = new Float32Array(GW * GH), GG = new Float32Array(GW * GH), GB2 = new Float32Array(GW * GH), GT = new Float32Array(GW * GH), GTI = new Uint8Array(GW * GH);
  const LUMP = PAL.map((p) => p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15);
  const BLOOM_T = [[T_WH, [1, 1, 1]], [T_GOLD, [1, 0.75, 0.25]], [T_WARM, [1, 0.69, 0.38]], [T_MAG, [1, 0.23, 0.78]], [T_CYAN, [0.25, 0.85, 1]], [T_BL, [0.25, 0.6, 0.95]], [T_VI, [0.6, 0.36, 0.94]], [T_GR, [0.42, 0.75, 0.25]]];
  const VIG = new Float32Array(NP);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2 - LB), r = Math.sqrt(dx * dx * 0.8 + dy * dy * 0.6); VIG[y * W + x] = 0.3 * sstep(0.62, 1.2, r); }
  function blur(A) {
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < GH; y++) { let acc = 0; const row = y * GW; for (let x = -3; x < GW + 3; x++) { if (x + 3 < GW) acc += A[row + x + 3]; if (x - 4 >= 0) acc -= A[row + x - 4]; if (x >= 0 && x < GW) GT[row + x] = acc / 7; } }
      for (let x = 0; x < GW; x++) { let acc = 0; for (let y = -3; y < GH + 3; y++) { if (y + 3 < GH) acc += GT[(y + 3) * GW + x]; if (y - 4 >= 0) acc -= GT[(y - 4) * GW + x]; if (y >= 0 && y < GH) A[y * GW + x] = acc / 7; } }
    }
  }
  function grade() {
    GR.fill(0); GG.fill(0); GB2.fill(0);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const c = BUF[y * W + x], l = LUMP[c]; if (l < 175) continue;
      const k = (l - 175) / 80 / (GC * GC), p = PAL[c], j = fl(y / GC) * GW + fl(x / GC);
      GR[j] += p[0] / 255 * k; GG[j] += p[1] / 255 * k; GB2[j] += p[2] / 255 * k;
    }
    blur(GR); blur(GG); blur(GB2);
    for (let j = 0; j < GW * GH; j++) {
      const r = GR[j], g = GG[j], b = GB2[j], m = Math.max(r, g, b); GT[j] = m > 0.02 ? m : 0; if (m <= 0.02) continue;
      let best = 0, bd = 1e9; BLOOM_T.forEach(([, q], k) => { const d = (r / m - q[0]) ** 2 + (g / m - q[1]) ** 2 + (b / m - q[2]) ** 2; if (d < bd) { bd = d; best = k; } }); GTI[j] = best;
    }
    for (let y = LB; y < H - LB; y++) {
      const gy = Math.min(GH - 1, fl(y / GC));
      for (let x = 0; x < W; x++) {
        const i = y * W + x, j = gy * GW + fl(x / GC), m = GT[j];
        if (m > 0 && LUMP[BUF[i]] < m * 255 * 2.2) tintI(i, x, y, BLOOM_T[GTI[j]][0], Math.min(0.42, m * 1.4) * 0.5);
        if (VIG[i] > 0.01) tintI(i, x, y, T_DARK, VIG[i]);
      }
    }
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
  if (typeof window !== 'undefined') window.__sunderer_core = { render, BUF, PAL, W, H, D, SHAKE: () => [SHX, SHY] };
  (window.PIECES = window.PIECES || []).push({
    id: 'the-sunderer',
    title: 'The Sunderer',
    medium: 'Pixel art in 124 colours, 480 × 270, drawn in JavaScript · 3 min',
    note: 'Fable Saga, part IV · tap to pause',
    about: 'Part four of the Fable saga. The Unmaker is gone, but one eye in a shard of its mask still watched, and its brother answered. The Sunderer does not erase; he breaks. A three-minute fight past every limit the hero has: Zenith, Nova, Last Light and Fable Infinite, and a sword that grows until it is longer than the world. Drawn frame by frame in JavaScript into a 480 × 270 buffer of 124 colours. An unofficial fan concept, not affiliated with Anthropic.',
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
        window.__thesunderer = {
          duration: D,
          isReady: () => ready && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__thesunderer.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-unmaker';
        api.ready();
      } else {
        window.__thesunderer = { duration: D, isReady: () => ready, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
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
          if (window.__thesunderer) delete window.__thesunderer;
        },
      };
    },
  });

})();
