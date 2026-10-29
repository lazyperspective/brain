/* Carry — an endless zoom.
 *
 * A snail on a flower, and everything it carries, in a fifteen-second loop. Every frame is a pure
 * function of t, drawn into a 480 × 270 indexed buffer in 149 colours and shown at 4×; the film is one unbroken zoom.
 * Built from the parts in fable-saga/production/carry/src.
 */
(function () {
  'use strict';
  /* ================================================================ constants & helpers */
  const W = 480, H = 270, NP = W * H, D = 15;
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
    // Carry
    '102a2c', '1e4a48', '347a70', '5aae98', '94dcc0', 'd6f6e4',                                   // 124-129 the snail (translucent sea-glass green)
    '3a2414', '6e4420', 'a87030', 'e0aa54',                                                       // 130-133 the shell's rim (amber horn)
    '0c1426', '142240', '1e3458', '2e4c74', '4a6e96',                                             // 134-138 night blues (sky, water, distance)
    '0e1e12', '17301c', '24462a', '386440', '58884e',                                             // 139-143 night meadow greens
    'ffe9b8', 'ffc878', 'f08a48',                                                                 // 144-146 warm window light
    '9ad8ff', 'd8f0ff',                                                                           // 147-148 atmosphere, ice
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
    // lowercase (for the typed command) and the prompt
    '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
    u: ['....', '....', '#..#', '#..#', '#..#', '#..#', '.###'], l: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '.##'],
    t: ['.#..', '.#..', '####', '.#..', '.#..', '.#..', '..##'], r: ['....', '....', '#.##', '##..', '#...', '#...', '#...'],
    a: ['....', '....', '.##.', '...#', '.###', '#..#', '.###'], h: ['#...', '#...', '#.#.', '##.#', '#..#', '#..#', '#..#'],
    i: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'], n: ['....', '....', '#.#.', '##.#', '#..#', '#..#', '#..#'],
    k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
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
    // the ink-and-light impact frame only for the heavy blows (lighter ones flash light instead): fewer jolts, more flow
    if (g < 0.03) { if (power >= 2.5) impactFrame(x, y, power >= 2.8 ? 1 : 0); else glow(x, y, 34 * power, T_WH, 0.45); }
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

  /* high above the cloud sea, after he has come: the dawn sky stained by him (crimson high up, burning orange at the horizon),
     the sun low behind the cloud with rays thrown up through it, three decks of cloud moving with parallax (ox), embers
     drifting on the wind. highFore draws the nearest deck, to go in front of whatever stands in the cloud. */
  function highSky(t, ox, sunX, sunY, stain) {
    ox = ox || 0; sunX = sunX === undefined ? 380 : sunX; sunY = sunY === undefined ? 168 : sunY; stain = stain === undefined ? 0.6 : stain;
    gradient(LB, 200, [97, 98, 10, 11, 12, 13, 14, 15]);
    glow(sunX, sunY, 210, T_WARM, 0.55); glow(sunX, sunY, 90, T_WH, 0.35);
    discF(sunX, sunY, 20, 15); discF(sunX, sunY, 16, 16); discF(sunX - 3, sunY - 3, 8, 22);
    z5GodRays(sunX, sunY, 8, t * 0.08, T_WARM, 0.32, 430);
    cloudBank(162, 24, 90, 1171, ox * 0.25 + t * 3, [12, 13, 14, 15], false);
    cloudBank(190, 32, 70, 1172, ox * 0.55 + t * 6, [10, 11, 13, 14], false);
    if (stain > 0) tintAll(T_BLOOD, stain * 0.22);
    for (let k = 0; k < 30; k++) { const g = frac(t * (0.1 + ih(k, 3, 1173) * 0.12) + ih(k, 1, 1173)), x = ((ih(k, 2, 1173) * 560 - g * 300 - ox * 0.8) % 560 + 560) % 560 - 40, y = LB + 10 + ih(k, 4, 1173) * 190 - g * 40 + Math.sin(t * 2 + k) * 3; P(x, y, k % 4 ? 104 : 106); if (k % 3 === 0) P(x + 1, y, 103); }
  }
  function highFore(t, ox, y0) { cloudBank(y0 || 232, 44, 52, 1174, (ox || 0) + t * 10, [9, 10, 11, 13], false); }

  /* ================================================================ Carry: the endless zoom — the kit every layer uses
     The film is one continuous pull-back through seven layers of scale, each ZR = 8 times larger than the one inside it,
     and then it is back where it began (layer 7 is layer 0). Each layer is drawn in its own units: at its nominal size
     (u = 1) one unit is one screen pixel and its origin is the centre of the frame (240, 135). The layer inside it lives at
     its origin, 1/8 the size, and shows through its window (mask). */
  const ZR = 8, ZN = 7, ZD = 15;
  const ZA = 7 * 0.85 / (2 * PI);
  // how far out we are, in layers, at time t: slow at the loop's seam (the snail), fastest in deep space. zS(15) = 7 ≡ 0.
  const zS = (t) => 7 * t / ZD - ZA * Math.sin(2 * PI * t / ZD);
  // a phase that comes back round exactly every 15 s (n turns per loop): use it for EVERY motion, so the loop is seamless
  const zP = (t, n) => 2 * PI * (n === undefined ? 1 : n) * t / ZD;
  const zMod = (k) => ((k % ZN) + ZN) % ZN;
  // the layers: ZL[k] = { name, draw(V, t), mask(x, y) -> 0..1 (optional; the window where the layer inside shows),
  //   maskBox: [x0, y0, x1, y1] (optional; the window's bounds, in this layer's units) }
  const ZL = [];
  // the default window: a soft-edged rectangle at the origin — full inside 60 × 34, fading out to 72 × 44
  const zRectMask = (x, y) => clamp((36 - Math.abs(x)) / 6, 0, 1) * clamp((22 - Math.abs(y)) / 5, 0, 1);
  const ZRECT_BOX = [-36, -22, 36, 22], ZRECT_HOLE = [-30, -17, 30, 17];   // (HOLE: where the mask is whole)

  /* the view a layer is drawn through. V.u: screen px per unit. V.X(x), V.Y(y): unit → screen; V.S(n): a length.
     V.lx(X), V.ly(Y): screen pixel → unit (pixel centre). V.box: the screen rect [X0, Y0, X1, Y1] (inclusive) where this
     layer's content is valid (|x|, |y| ≤ V.R units, default 420), clipped to the frame — keep your work inside it.
     V.each(x0, y0, x1, y1, fn): for every screen pixel whose centre falls in that box of units (and in V.box), calls
     fn(x, y, X, Y) with unit coords x, y and screen X, Y; return a palette index to paint it, or -1 to leave it.
     V.vis(x0, y0, x1, y1): does that box of units touch the frame at all (skip work when it doesn't).
     V.lod: a detail level (0 when the layer is tiny on screen, 1 at nominal size, > 1 when magnified).
     V.hole: a screen rect [X0, Y0, X1, Y1] that the layer inside will cover completely (or null) — skip it: V.each does. */
  function zView(u, R, clip, hole) {
    R = R || 420;
    const cx = 240, cy = 135, V = { u, cx, cy, R };
    V.X = (x) => cx + x * u; V.Y = (y) => cy + y * u; V.S = (n) => n * u;
    V.lx = (X) => (X + 0.5 - cx) / u; V.ly = (Y) => (Y + 0.5 - cy) / u;
    V.box = [Math.max(0, fl(cx - R * u)), Math.max(0, fl(cy - R * u)), Math.min(W - 1, Math.ceil(cx + R * u)), Math.min(H - 1, Math.ceil(cy + R * u))];
    // an inner layer only shows through the outer layer's window: the compositor passes that window's screen rect, and
    // per-pixel work outside it is skipped (V.clipped says so; a layer may also use V.box to skip its own loops)
    if (clip) { V.box[0] = Math.max(V.box[0], clip[0]); V.box[1] = Math.max(V.box[1], clip[1]); V.box[2] = Math.min(V.box[2], clip[2]); V.box[3] = Math.min(V.box[3], clip[3]); V.clipped = true; }
    V.hole = hole || null;
    V.vis = (x0, y0, x1, y1) => V.X(x1) >= 0 && V.X(x0) < W && V.Y(y1) >= 0 && V.Y(y0) < H;
    V.each = (x0, y0, x1, y1, fn) => {
      const X0 = Math.max(V.box[0], fl(V.X(x0))), X1 = Math.min(V.box[2], Math.ceil(V.X(x1))), Y0 = Math.max(V.box[1], fl(V.Y(y0))), Y1 = Math.min(V.box[3], Math.ceil(V.Y(y1)));
      const Hh = V.hole;
      for (let Y = Y0; Y <= Y1; Y++) { const y = (Y + 0.5 - cy) / u; if (y < y0 || y > y1) continue; const hr = Hh && Y >= Hh[1] && Y <= Hh[3]; for (let X = X0; X <= X1; X++) { if (hr && X >= Hh[0] && X <= Hh[2]) { X = Hh[2]; continue; } const x = (X + 0.5 - cx) / u; if (x < x0 || x > x1) continue; const c = fn(x, y, X, Y); if (c >= 0) BUF[Y * W + X] = c; } }
    };
    V.lod = clamp(Math.log(u * 8) / Math.log(8), 0, 2);
    return V;
  }
  // useful shapes, in a view's units
  const zDisc = (V, x, y, r, c) => { if (V.S(r) < 0.35) { if (V.S(r) > 0.12) P(V.X(x), V.Y(y), c); return; } discF(V.X(x), V.Y(y), V.S(r), c); };
  const zLine = (V, x0, y0, x1, y1, c) => lineP(V.X(x0), V.Y(y0), V.X(x1), V.Y(y1), c);
  const zGlow = (V, x, y, r, T, a) => glow(V.X(x), V.Y(y), V.S(r), T, a);
  // a field of stars over a box of units, the same on screen at every zoom: octaves of cells (each twice the last), each
  // cell's star fading in as the cell grows from P0 to 2·P0 screen pixels, so the sky holds `dens` stars per 1000 screen
  // pixels whatever the layer's size and never swims (L1's scheme). Twinkling on the loop. ok(x, y), if given: may a star be here?
  // (false: no; true: yes; or a palette ramp of its own for this star)
  function zStars(V, t, x0, y0, x1, y1, dens, seed, cols, ok) {
    cols = cols || [136, 19, 20, 21, 22];
    const u = V.u, P0 = Math.sqrt(340 / dens), Yt = Math.max(V.box[1], LB), Yb = Math.min(V.box[3], H - 1 - LB);
    const xa = Math.max(x0, V.lx(V.box[0] - 1)), xb = Math.min(x1, V.lx(V.box[2] + 1)), ya = Math.max(y0, V.ly(Yt - 1)), yb = Math.min(y1, V.ly(Yb + 1));
    if (xb < xa || yb < ya) return;
    for (let k = Math.ceil(Math.log2(P0 / u)); k < 40; k++) {
      const cs = Math.pow(2, k), pc = cs * u; if (cs > 4 * Math.max(x1 - x0, y1 - y0)) break;
      const fade = sstep(P0, 2 * P0, pc), sd = seed + (k + 64) * 17;
      const i0 = fl(xa / cs), i1 = fl(xb / cs), j0 = fl(ya / cs), j1 = fl(yb / cs);
      for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) {
        const h = ih(ii, jj, sd); if (h > fade) continue;
        const x = (ii + ih(ii, jj, sd + 1)) * cs, y = (jj + ih(ii, jj, sd + 2)) * cs; if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        const X = fl(V.X(x)), Y = fl(V.Y(y)); if (X < V.box[0] || X > V.box[2] || Y < Yt || Y > Yb) continue;
        if (V.hole && X >= V.hole[0] && X <= V.hole[2] && Y >= V.hole[1] && Y <= V.hole[3]) continue;
        const okv = ok ? ok(x, y) : true; if (!okv) continue; const cl = okv === true ? cols : okv;
        const b = ih(ii, jj, sd + 3), tw = 0.5 + 0.5 * Math.sin(zP(t, 1 + fl(ih(ii, jj, sd + 4) * 4)) + 6.28 * ih(ii, jj, sd + 5)), hue = ih(ii, jj, sd + 6);
        const lv = b * b * (0.55 + 0.45 * tw) * clamp((fade - h) / 0.35, 0.25, 1);
        let c = lv > 0.62 ? cl[4] : lv > 0.4 ? cl[3] : lv > 0.22 ? cl[2] : lv > 0.1 ? cl[1] : cl[0];
        if (lv > 0.22 && hue < 0.08) c = lv > 0.45 ? 16 : 15; else if (lv > 0.22 && hue > 0.9) c = lv > 0.45 ? 148 : 147;
        BUF[Y * W + X] = c;
        if (lv > 0.62 && b > 0.95) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = X + ox, yy = Y + oy; if (xx >= V.box[0] && xx <= V.box[2] && yy >= Yt && yy <= Yb) BUF[yy * W + xx] = cl[1]; }
      }
    }
  }
  // the aurora's rays: how bright a curtain is at `fold` along it (L2's units, already folded by the wind) and `h` above its
  // foot (L2's units): irregular rays of uneven height, leaning as they rise. Every layer that shows it (L2–L4) uses this.
  const zN1 = (z, s) => { const i = fl(z), f = z - i, w = f * f * (3 - 2 * f), a = ih(i, 7, s); return a + (ih(i + 1, 7, s) - a) * w; };   // 1-D value noise
  function zAur(fold, h) {
    const f = fold + 0.16 * h * Math.sin(fold / 60), r1 = zN1(f * 0.19, 2261), r2 = zN1(f * 0.53, 2262), r3 = zN1(f * 0.043, 2263);
    return 1.1 * clamp(0.08 + 0.8 * r1 * r1 + 0.45 * r2 * r2, 0, 1.3) * (0.5 + 0.65 * r3) * Math.exp(-h / (16 + 22 * r1 * r3));
  }
  // a hook for one layer to lend its look to another (L6 lends L5 the galaxy's light, so the seam between them vanishes)
  const ZSH = {};

  /* ---------------------------------------------------------------- the compositor (one shot, the whole film) */
  const ZSAVE = new Uint8Array(NP);
  const Z_FALL = [135, 140, 137, 143, 117, 78, 62];
  function zDraw(k, u, t, clip, hole) {
    const L = ZL[zMod(k)], V = zView(u, L && L.R, clip, hole);
    if (L) { L.draw(V, t); return V; }
    // (a layer not written yet: a flat placeholder with its number)
    V.each(-420, -420, 420, 420, () => Z_FALL[zMod(k)]);
    if (V.u > 0.3) text(String(zMod(k)), V.X(0) - 6 * V.u, V.Y(0) - 10 * V.u, 22, Math.max(1, Math.round(4 * V.u)));
    return V;
  }
  // keep the inner layer (just drawn over everything) only inside the outer layer's window; elsewhere restore the outer
  function zWindow(kOut, uOut) {
    const L = ZL[zMod(kOut)], mask = (L && L.mask) || zRectMask, mb = (L && L.maskBox) || ZRECT_BOX;
    const X0 = fl(240 + mb[0] * uOut), X1 = Math.ceil(240 + mb[2] * uOut), Y0 = fl(135 + mb[1] * uOut), Y1 = Math.ceil(135 + mb[3] * uOut);
    for (let Y = 0; Y < H; Y++) {
      const o = Y * W;
      if (Y < Y0 || Y > Y1) { BUF.set(ZSAVE.subarray(o, o + W), o); continue; }
      const y = (Y + 0.5 - 135) / uOut;
      for (let X = 0; X < W; X++) {
        if (X < X0 || X > X1) { BUF[o + X] = ZSAVE[o + X]; continue; }
        const a = mask((X + 0.5 - 240) / uOut, y);
        if (a <= 0 || (a < 1 && bay(X, Y) >= a)) BUF[o + X] = ZSAVE[o + X];
      }
    }
  }
  function zFrame(t) {
    const s = zS(t), k = Math.floor(s + 1e-9), f = s - k;
    // the outermost layer first (magnified, filling the frame), then each layer inside it, in its window
    let uO = Math.pow(ZR, 1 - f);
    const plan = [[k + 1, uO, null]];
    for (let n = 0; n < 3; n++) {
      const kk = k - n, u = uO / ZR;
      if (u * 840 < 1.5) break;                                   // smaller than a pixel or two: nothing to see
      const Lo = ZL[zMod(kk + 1)], mb = (Lo && Lo.maskBox) || ZRECT_BOX;
      const clip = [Math.max(0, fl(240 + mb[0] * uO) - 1), Math.max(0, fl(135 + mb[1] * uO) - 1), Math.min(W - 1, Math.ceil(240 + mb[2] * uO) + 1), Math.min(H - 1, Math.ceil(135 + mb[3] * uO) + 1)];
      if (clip[2] < clip[0] || clip[3] < clip[1]) break;
      plan.push([kk, u, clip]); uO = u;
    }
    // each layer with one inside it may skip the part of the frame that layer will cover whole (a rect window's middle)
    for (let i = 0; i < plan.length; i++) {
      const [kk, u, clip] = plan[i], L = ZL[zMod(kk)], hb = i + 1 < plan.length && L && !L.mask ? ZRECT_HOLE : null;
      const hole = hb ? [Math.ceil(240 + hb[0] * u - 0.5) + 1, Math.ceil(135 + hb[1] * u - 0.5) + 1, fl(240 + hb[2] * u - 0.5) - 1, fl(135 + hb[3] * u - 0.5) - 1] : null;
      if (i > 0) ZSAVE.set(BUF);
      zDraw(kk, u, t, clip, hole && hole[2] > hole[0] && hole[3] > hole[1] ? hole : null);
      if (i > 0) zWindow(kk + 1, plan[i - 1][1]);
    }
  }
  if (typeof window !== 'undefined') window.__carry = { zS, zP, ZL, zView, zDraw, zFrame, ZR, ZN, ZD };

  /* ================================================================ Carry: the snail's planet (shared by L3, L4 and L5)
     One world, drawn wherever it appears at whatever size, from one baked texture so that every layer shows the same seas,
     the same continents, the same clouds and cities. Its north pole is tipped 32° toward us, so the top limb — where the
     snail lives (the origin of L3, L4 and L5) — is at latitude 58°, just south of the aurora oval. The sun is behind it and
     to the left (a crescent of day on the lower left); the snail's side is night.
     gPlanet(V, cx, cy, R, t, o): draw the disc of radius R units about (cx, cy) into the view, with its atmosphere glow, its
     aurora and its night lights; o = { glowW (atmosphere thickness in units), aur (aurora strength), detail } */
  const GP_A = [0, -0.85, 0.527], GP_B = [1, 0, 0], GP_C = [0, 0.527 * 0, 0];
  { const a = GP_A, l = Math.hypot(a[0], a[1], a[2]); a[0] /= l; a[1] /= l; a[2] /= l; GP_C[0] = a[1] * GP_B[2] - a[2] * GP_B[1]; GP_C[1] = a[2] * GP_B[0] - a[0] * GP_B[2]; GP_C[2] = a[0] * GP_B[1] - a[1] * GP_B[0]; }
  const GP_S = (() => { const s = [-0.62, 0.35, -0.7], l = Math.hypot(s[0], s[1], s[2]); return s.map((v) => v / l); })();
  // 3D value noise and fbm (for baking)
  function vn3(x, y, z, s) {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
    const h = (a, b, c) => ih(a, Math.imul(b, 40503) ^ Math.imul(c, 9973), s);
    const x00 = lerp(h(i, j, k), h(i + 1, j, k), ux), x10 = lerp(h(i, j + 1, k), h(i + 1, j + 1, k), ux);
    const x01 = lerp(h(i, j, k + 1), h(i + 1, j, k + 1), ux), x11 = lerp(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), ux);
    return lerp(lerp(x00, x10, uy), lerp(x01, x11, uy), uz);
  }
  function fbm3(x, y, z, oct, s) { let v = 0, a = 1, n = 0, f = 1; for (let k = 0; k < oct; k++) { v += a * vn3(x * f, y * f, z * f, s + k * 37); n += a; a *= 0.5; f *= 2.03; } return v / n; }
  // the bake: an equirectangular map of height (land > 128), clouds, and a city factor
  const GT_W = 768, GT_H = 384, GT_LAND = new Uint8Array(GT_W * GT_H), GT_CLOUD = new Uint8Array(GT_W * GT_H);
  let GT_BAKED = false;
  // where the snail lives (view-space up, in the planet's frame): its continent is guaranteed
  const GP_N0 = [GP_B[1] * -1, GP_C[1] * -1, GP_A[1] * -1];
  // (baked on first use, so the gallery's page load never pays for it)
  function gBake() {
  GT_BAKED = true;
  for (let j = 0; j < GT_H; j++) {
    const lat = (0.5 - (j + 0.5) / GT_H) * PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < GT_W; i++) {
      const lon = ((i + 0.5) / GT_W - 0.5) * TAU, px = cl * Math.cos(lon), py = cl * Math.sin(lon), pz = sl;
      const wx = vn3(px * 1.3 + 5, py * 1.3, pz * 1.3, 9100) - 0.5, wy = vn3(px * 1.3, py * 1.3 + 7, pz * 1.3, 9101) - 0.5;
      let h = fbm3(px * 2.1 + wx * 0.9, py * 2.1 + wy * 0.9, pz * 2.1, 4, 9102);
      h = 0.5 + (h - 0.5) * 1.6;                                         // more contrast: real continents and real seas
      const dn = (px - GP_N0[0]) ** 2 + (py - GP_N0[1]) ** 2 + (pz - GP_N0[2]) ** 2;
      h += 0.16 * Math.exp(-dn / 0.09) - 0.03;
      const c = fbm3(px * 3.2 + wx * 2.2, py * 3.2 + wy * 2.2, pz * 3.2 + 3, 3, 9103) * (0.75 + 0.5 * Math.abs(Math.sin(lat * 2.6))) * (1 - 0.75 * Math.exp(-dn / 0.07));   // (a clear night over the snail)
      GT_LAND[j * GT_W + i] = clamp(fl(h * 255), 0, 255); GT_CLOUD[j * GT_W + i] = clamp(fl(c * 255), 0, 255);
    }
  }
  }
  function gSample(T, lon, lat) {
    const fx = ((lon / TAU + 0.5) * GT_W - 0.5 + GT_W * 4) % GT_W, fy = clamp((0.5 - lat / PI) * GT_H - 0.5, 0, GT_H - 1.001);
    const i = fl(fx), j = fl(fy), ax = fx - i, ay = fy - j, i1 = (i + 1) % GT_W, j1 = Math.min(GT_H - 1, j + 1);
    return ((T[j * GT_W + i] * (1 - ax) + T[j * GT_W + i1] * ax) * (1 - ay) + (T[j1 * GT_W + i] * (1 - ax) + T[j1 * GT_W + i1] * ax) * ay) / 255;
  }
  const GP_NIGHT_SEA = [0, 114, 115], GP_DAY_SEA = [88, 45, 46, 47], GP_DAY_LAND = [24, 25, 26, 26, 48, 26], GP_TERM = [9, 10, 28, 25], GP_TERM_S = [9, 10, 88, 45];
  // the colour of the surface at view normal (nx, ny, nz) (ny down the screen, nz toward us), at screen pixel (X, Y)
  function gSurface(nx, ny, nz, X, Y, t, det) {
    const p0 = nx * GP_B[0] + ny * GP_B[1] + nz * GP_B[2], p1 = nx * GP_C[0] + ny * GP_C[1] + nz * GP_C[2], p2 = nx * GP_A[0] + ny * GP_A[1] + nz * GP_A[2];
    const lat = Math.asin(clamp(p2, -1, 1)), lon = Math.atan2(p1, p0), d = bay(X, Y);
    let h = gSample(GT_LAND, lon, lat);
    if (det > 0) h += (vn(lon * 900, lat * 900, 1, 9104) - 0.5) * 0.035 * det;
    const cloudOff = 0.03 * Math.sin(zP(t, 1)) + 0.02 * Math.sin(zP(t, 2) + lat * 3);
    const c0 = gSample(GT_CLOUD, lon + cloudOff, lat), cl = c0 * 0.55 + gSample(GT_CLOUD, lon * 3 + c0 * 2.5 + cloudOff * 2, lat * 3 + 0.7) * 0.45 + (det > 0 ? (vn(lon * 400 + 3, lat * 400, 1, 9105) - 0.5) * 0.06 * det : 0);
    const sun = nx * GP_S[0] + ny * GP_S[1] + nz * GP_S[2], alat = Math.abs(lat), land = h > 0.5, ice = alat > 1.43 || (alat > 1.38 && h > 0.5);
    const cloud = cl > 0.55 ? clamp((cl - 0.55) / 0.16, 0, 1) : 0, lim = nz;          // lim: small near the limb (grazing)
    let c;
    if (sun > 0.035) {
      // day: blue oceans, green and gold land, white ice and clouds; brighter toward the sun
      const b = clamp(sun * 2.5, 0, 1);
      if (ice) c = b > 0.4 ? (d < 0.6 ? 22 : 21) : (d < 0.5 ? 21 : 20);
      else if (land) { const e = h - 0.5; c = GP_DAY_LAND[clamp(fl(e * 22 + b * 2.4 + d * 0.9), 0, 5)]; }
      else c = GP_DAY_SEA[clamp(fl(b * 2.6 + d * 0.9 + (h - 0.45) * 5), 0, 3)];
      if (cloud > d * 0.9 + 0.05) c = b > 0.35 ? (cloud > 0.6 ? 22 : 21) : (cloud > 0.6 ? 21 : 20);
    } else if (sun > -0.025) {
      c = d < (sun + 0.025) / 0.06 ? (land ? GP_TERM : GP_TERM_S)[clamp(fl((sun + 0.025) * 60), 0, 3)] : (land ? 23 : 114);    // a thin band of dusk, warm and dim
    } else {
      // night: dark seas, darker land, pale ice, moonlit clouds, and cities strung along the coasts
      if (ice) { const e = h - 0.5 + (cl - 0.5) * 0.4; c = e > 0.08 ? (d < 0.55 ? 135 : 134) : e > -0.05 ? (d < 0.45 ? 134 : 2) : (d < 0.25 ? 134 : 2); }
      else if (land) { const e = h - 0.5; c = e < 0.012 ? (d < 0.6 ? 139 : 23) : e > 0.14 ? (d < 0.35 ? 139 : 23) : (d < 0.22 ? 139 : d < 0.75 ? 23 : 1); }
      else c = h > 0.47 ? (d < 0.5 ? 115 : 114) : (d < 0.2 ? 115 : 114);
      if (cloud > d * 1.1 + 0.12) c = cloud > 0.8 ? (d < 0.3 ? 135 : 134) : cloud > 0.5 ? (d < 0.4 ? 134 : 2) : 2;
      if (land && !ice && cloud < 0.5) {
        const coast = 1 - clamp((h - 0.5) / 0.05, 0, 1), k = ih(fl(lon * 300), fl(lat * 300), 9106), kc = (0.01 + coast * 0.3);
        if (k < kc * 1.8 && alat < 1.25) {                       // (only then can there be a light here: look closer)
          const town = vn(lon * 40, lat * 40, 1, 9107), on = 0.5 + 0.5 * Math.sin(zP(t, 1 + (k * 4 | 0)) + k * 40);
          if (k < kc * (town > 0.62 ? 1.8 : town > 0.5 ? 0.6 : 0.08) && on > 0.12) c = k < 0.025 ? 53 : k < 0.15 ? 144 : 145;
        }
      }
      // the limb: haze and airglow
      if (lim < 0.06) c = lim < 0.025 ? (d < 0.6 ? 137 : 136) : (d < 0.5 ? 135 : c);
    }
    return c;
  }
  // the aurora oval about the north pole (lat ≈ 64–70°): its strength at (lat, lon)
  function gAurora(lat, lon, t) {
    const a = lat - 1.16 - 0.04 * Math.sin(lon * 3 + zP(t, 1)) - 0.03 * Math.sin(lon * 7 - zP(t, 2));
    return Math.exp(-a * a / 0.0011) * (0.7 + 0.3 * Math.sin(lon * 60 + zP(t, 2)) * Math.sin(lon * 23 - zP(t, 1))) * (0.65 + 0.35 * Math.sin(lon * 3 - zP(t, 1)));
  }
  function gPlanet(V, cx, cy, R, t, o) {
    o = o || {};
    if (!GT_BAKED) gBake();
    const u = V.u, Rp = R * u, CX = V.X(cx), CY = V.Y(cy), gw = (o.glowW || R * 0.035) * u, det = o.detail || 0, aur = o.aur === undefined ? 1 : o.aur;
    if (Rp < 0.7) { P(CX, CY, 136); return; }
    const X0 = Math.max(V.box[0], fl(CX - Rp - gw - 1)), X1 = Math.min(V.box[2], Math.ceil(CX + Rp + gw + 1));
    const Y0 = Math.max(V.box[1], LB, fl(CY - Rp - gw - 1)), Y1 = Math.min(V.box[3], H - 1 - LB, Math.ceil(CY + Rp + gw + 1));
    for (let Y = Y0; Y <= Y1; Y++) {
      const ny = (Y + 0.5 - CY) / Rp, hr = V.hole && Y >= V.hole[1] && Y <= V.hole[3];
      for (let X = X0; X <= X1; X++) {
        if (hr && X >= V.hole[0] && X <= V.hole[2]) { X = V.hole[2]; continue; }
        const nx = (X + 0.5 - CX) / Rp, r2 = nx * nx + ny * ny;
        if (r2 > 1) {
          // the atmosphere outside the limb: a thin glow, warm on the sunward side, airglow and aurora elsewhere
          const hgt = (Math.sqrt(r2) - 1) * Rp; if (hgt > gw) continue;
          const f = 1 - hgt / gw, sunw = (nx * GP_S[0] + ny * GP_S[1]) / Math.sqrt(r2), dd = bay(X, Y);
          if (sunw > 0.3) { if (dd < f * f * 0.9) BUF[Y * W + X] = f > 0.7 ? 148 : 147; }
          else if (dd < f * f * 0.75) BUF[Y * W + X] = f > 0.75 ? 137 : 136;
          continue;
        }
        const nz = Math.sqrt(1 - r2);
        let c = gSurface(nx, ny, nz, X, Y, t, det);
        const p2 = aur > 0 ? nx * GP_A[0] + ny * GP_A[1] + nz * GP_A[2] : 0;
        if (aur > 0 && p2 > 0.84 && p2 < 0.97) {                  // (the oval's band of latitude, 1.0–1.33 rad)
          const p1 = nx * GP_C[0] + ny * GP_C[1] + nz * GP_C[2], p0 = nx * GP_B[0] + ny * GP_B[1] + nz * GP_B[2];
          const A = gAurora(Math.asin(clamp(p2, -1, 1)), Math.atan2(p1, p0), t) * aur, dd = bay(X, Y);
          if (A > 0.62 + dd * 0.3) c = 49; else if (A > 0.4 + dd * 0.3) c = 48; else if (A > 0.22 + dd * 0.3) c = 125; else if (A > 0.1 + dd * 0.25) c = c === 0 || c === 114 || c === 1 || c === 23 ? 124 : c;
        }
        // o.darkAt [x, y, r] (units): the ground darkens toward that spot (the snail's own dark meadow, seen from above)
        if (o.darkAt) { const [qx, qy, qr] = o.darkAt, ddx = (X + 0.5 - V.X(qx)) / u, ddy = (Y + 0.5 - V.Y(qy)) / u, f = 1 - Math.sqrt(ddx * ddx + ddy * ddy) / qr; if (f > 0 && bay(X, Y) < f * 1.4) c = GP_DARKER[c] === undefined ? c : GP_DARKER[c]; }
        BUF[Y * W + X] = c;
      }
    }
  }
  const GP_DARKER = { 140: 139, 139: 23, 24: 23, 23: 1, 25: 24, 145: 23, 144: 145, 115: 114, 114: 0, 135: 134, 134: 2, 2: 1 };

  /* ================================================================ Carry · L0 — the snail (the face of the film)
     A close portrait at night. A small sea-glass snail sits in a night lotus and looks up at the sky. Its shell is the
     window: inside r < 64 about (-18, -8) the compositor shows the galaxy (L6), so here we paint everything around it — the
     amber horn of the shell's rim, ridged with growth lines and lit from inside by the galaxy; the snail's translucent body,
     its eyestalks and its face; the flower and its stem; the night sky with a soft aurora; the meadow far below and its
     fireflies. And the acting: a blink at 0.3 s, a shooting star at 0.6–1.3 s that the eyes follow, and a firefly that
     drifts past the face at 2 s and again at 13.5 s. Every motion comes round exactly once per 15 s loop (zP). */
  {
    // ---- geometry, in L0 units (one unit is one screen pixel at nominal size; the origin is the frame centre)
    const c0SX = -18, c0SY = -8;                                    // the shell's centre: the window is r < 64 around it
    const c0Mask = (x, y) => { const dx = x - c0SX, dy = y - c0SY, r = Math.sqrt(dx * dx + dy * dy); return r <= 63 ? 1 : r >= 65 ? 0 : (65 - r) * 0.5; };
    const c0ROW0 = LB, c0ROW1 = H - 1 - LB;                         // the rows the letterbox leaves (nothing else is ever seen)
    const C0AMB = [130, 131, 132, 133, 15, 16, 22];                  // amber horn, shadow to blaze
    const C0GRN = [124, 125, 126, 127, 128, 129];                    // sea glass
    const C0PIN = [134, 135, 136, 5, 6, 7, 8, 56, 57];               // a petal's inner face: deep blue at the heart to lilac
    const C0POU = [1, 134, 135, 136, 137, 138, 147];                 // a petal's outer face: cooler, bluer
    const C0LEAF = [139, 140, 141, 142, 143, 50];
    const C0AUG = [135, 116, 124, 125, 48, 49];                      // the aurora's lower, green fringe
    const C0AUC = [135, 116, 117, 137, 61, 147];                     // and its upper, cyan veil
    // an ordered-dither pick along a ramp: v in [0, n - 1]
    const c0Rp = (R, v, X, Y) => { const i = fl(v + bay(X, Y)); return R[i < 0 ? 0 : i >= R.length ? R.length - 1 : i]; };
    // the same with the dither held to a narrow seam between flat bands (dw < 1): crisper, more deliberate
    const c0Rq = (R, v, X, Y, dw) => { const i = fl(v + 0.5 + (bay(X, Y) - 0.5) * dw); return R[i < 0 ? 0 : i >= R.length ? R.length - 1 : i]; };
    // the screen columns [S0, S1] that fall inside the shell's window on the row at unit y (none: S0 > S1)
    const C0SK = [0, 0];
    function c0Skip(u, y, r) {
      const dy = y - c0SY, h2 = r * r - dy * dy;
      if (h2 <= 0) { C0SK[0] = 1e9; C0SK[1] = -1e9; return; }
      const h = Math.sqrt(h2); C0SK[0] = Math.ceil(240 + (c0SX - h) * u - 0.5); C0SK[1] = fl(240 + (c0SX + h) * u - 0.5);
    }
    // like V.each, but only over the rows the letterbox leaves, and skipping the inside of the shell (the galaxy goes there)
    function c0Each(V, x0, y0, x1, y1, fn) {
      const u = V.u, b = V.box;
      const X0 = Math.max(b[0], fl(V.X(x0))), X1 = Math.min(b[2], Math.ceil(V.X(x1)));
      const Y0 = Math.max(b[1], c0ROW0, fl(V.Y(y0))), Y1 = Math.min(b[3], c0ROW1, Math.ceil(V.Y(y1)));
      for (let Y = Y0; Y <= Y1; Y++) {
        const y = (Y + 0.5 - 135) / u; if (y < y0 || y > y1) continue;
        c0Skip(u, y, 62.4); const S0 = C0SK[0], S1 = C0SK[1], o = Y * W;
        for (let X = X0; X <= X1; X++) {
          if (X >= S0 && X <= S1) { X = S1; continue; }
          const x = (X + 0.5 - 240) / u; if (x < x0 || x > x1) continue;
          const c = fn(x, y, X, Y); if (c >= 0) BUF[o + X] = c;
        }
      }
    }
    // the same over a ring about the shell's centre (r0 < r < r1)
    function c0Ann(V, r0, r1, fn) {
      const u = V.u, b = V.box, Y0 = Math.max(b[1], c0ROW0, fl(V.Y(c0SY - r1))), Y1 = Math.min(b[3], c0ROW1, Math.ceil(V.Y(c0SY + r1)));
      for (let Y = Y0; Y <= Y1; Y++) {
        const y = (Y + 0.5 - 135) / u;
        c0Skip(u, y, r1); if (C0SK[0] > C0SK[1]) continue;
        const A0 = Math.max(b[0], C0SK[0]), A1 = Math.min(b[2], C0SK[1]);
        c0Skip(u, y, r0); const S0 = C0SK[0], S1 = C0SK[1], o = Y * W;
        for (let X = A0; X <= A1; X++) {
          if (X >= S0 && X <= S1) { X = S1; continue; }
          const c = fn((X + 0.5 - 240) / u, y, X, Y); if (c >= 0) BUF[o + X] = c;
        }
      }
    }

    /* ---------------------------------------------------------------- the acting: everything that moves, per frame */
    const C0S0 = [-238, -104], C0S1 = [104, -88];                    // the shooting star's path (top left to the right)
    const C0EA = [148, -72], C0EB = [176, -56];                      // the eyes, at rest
    const c0F = { EA: {}, EB: {} };
    // the firefly that comes to visit the face (twice a loop): [x, y, brightness], or null
    function c0Visitor(t) {
      let p, x, y;
      if (t > 1.1 && t < 3.6) { p = (t - 1.1) / 2.5; x = lerp(238, 40, p) + 10 * Math.sin(p * 5.1); y = lerp(84, -30, p) + 8 * Math.sin(p * 9.4 + 0.6); }
      else if (t > 12.35 && t < 14.75) { p = (t - 12.35) / 2.4; x = lerp(212, 92, p) + 8 * Math.sin(p * 6.3 + 1); y = lerp(100, -36, p) + 7 * Math.sin(p * 8.8); }
      else return null;
      return [x, y, sstep(0, 0.13, p) * (1 - sstep(0.84, 1, p))];
    }
    function c0Meteor(t) {
      const p = (t - 0.6) / 0.7; if (p <= 0 || p >= 1) return null;
      const e = 1 - Math.pow(1 - p, 1.3);
      return [lerp(C0S0[0], C0S1[0], e), lerp(C0S0[1], C0S1[1], e), Math.pow(Math.sin(PI * p), 0.6), p];
    }
    const c0Nrm = (x, y) => { const l = Math.sqrt(x * x + y * y) || 1; return [x / l, y / l]; };

    /* the body is a smooth union of tapered capsules (a signed distance field), kept per frame in C0PR, C0ST numbers each:
       ax ay bx by ra rb k(smooth join) part | bbox x0 y0 x1 y1 | u0 u1 (how far along an eyestalk).
       parts: 0 foot, 1 neck and chest, 2 head, 3 lower tentacle, 4 eyestalk, 5 eye A, 6 eye B */
    const C0ST = 18, C0PR = new Float64Array(40 * C0ST), C0BB = [0, 0, 0, 0], C0ACT = new Int32Array(40);
    let c0Np = 0, c0Sid = 0, c0Srl = 1, c0Sal = 0, c0Gx = 0, c0Gy = 0;
    function c0Prim(ax, ay, bx, by, ra, rb, k, id, u0, u1) {
      const m = c0F.mr; ra = Math.max(ra, m); rb = Math.max(rb, m);
      const o = c0Np++ * C0ST, R = Math.max(ra, rb) + k + 6.5;      // (the margin lets c0Snail skip ahead safely)
      C0PR[o] = ax; C0PR[o + 1] = ay; C0PR[o + 2] = bx; C0PR[o + 3] = by; C0PR[o + 4] = ra; C0PR[o + 5] = rb; C0PR[o + 6] = k; C0PR[o + 7] = id;
      C0PR[o + 8] = Math.min(ax, bx) - R; C0PR[o + 9] = Math.min(ay, by) - R; C0PR[o + 10] = Math.max(ax, bx) + R; C0PR[o + 11] = Math.max(ay, by) + R;
      C0PR[o + 12] = u0 || 0; C0PR[o + 13] = u1 || 0;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; C0PR[o + 14] = dx; C0PR[o + 15] = dy; C0PR[o + 16] = L2 > 0 ? 1 / L2 : 0; C0PR[o + 17] = rb - ra;
      C0BB[0] = Math.min(C0BB[0], C0PR[o + 8]); C0BB[1] = Math.min(C0BB[1], C0PR[o + 9]); C0BB[2] = Math.max(C0BB[2], C0PR[o + 10]); C0BB[3] = Math.max(C0BB[3], C0PR[o + 11]);
    }
    // the field at (x, y) over the na primitives active on this row; also its gradient (c0Gx, c0Gy: exact for this smooth
    // union, whose gradient is the same blend of the parts' gradients), and the nearest part, its radius, how far along it
    const C0AX0 = new Float64Array(40), C0AX1 = new Float64Array(40);   // each active primitive's span on the current row
    function c0Field(x, y, na) {
      let s = 1e9, gx = 0, gy = 0, best = 1e9, id = -1, rl = 1, al = 0;
      const P = C0PR;
      for (let a = 0; a < na; a++) {
        if (x < C0AX0[a] || x > C0AX1[a]) continue;
        const o = C0ACT[a], bx = P[o + 14], by = P[o + 15], px = x - P[o], py = y - P[o + 1];
        let h = (px * bx + py * by) * P[o + 16]; h = h < 0 ? 0 : h > 1 ? 1 : h;
        const dx = px - bx * h, dy = py - by * h, dl = Math.sqrt(dx * dx + dy * dy) + 1e-9, r = P[o + 4] + P[o + 17] * h, d = dl - r, idl = 1 / dl, ex = dx * idl, ey = dy * idl;
        if (d < best) { best = d; id = P[o + 7]; al = P[o + 12] + (P[o + 13] - P[o + 12]) * h; }
        if (s > 1e8) { s = d; gx = ex; gy = ey; rl = r; }
        else { const k = P[o + 6], g = 0.5 + 0.5 * (d - s) / k, q = g < 0 ? 0 : g > 1 ? 1 : g; s = d + (s - d) * q - k * q * (1 - q); gx = ex + (gx - ex) * q; gy = ey + (gy - ey) * q; rl = r + (rl - r) * q; }
      }
      if (y - 67.6 > s) { s = y - 67.6; gx = 0; gy = 1; }           // the sole rests flat on the flower
      c0Sid = id; c0Srl = rl; c0Sal = al; c0Gx = gx; c0Gy = gy;
      return s;
    }
    // a point on the quadratic curve a → b (control c) at u
    const c0Bz = (a, c, b, u) => [(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1]];

    function c0Frame(V, t) {
      const F = c0F, u = V.u;
      F.u = u; F.mr = 0.6 / u;
      F.ol = u >= 0.3 ? Math.max(0.8, 1 / u) : 0;                  // the ink line, in units (none when tiny)
      F.olf = clamp((u - 0.3) / 0.12, 0, 1);                        // ...dissolving out as it shrinks, so it never pops
      F.lod = u >= 1.15 ? 2 : u >= 0.55 ? 1 : 0;
      F.tex = sstep(0.85, 1.45, u);                                  // how much fine texture (it fades in as we come close)
      F.fk = 255 * sstep(0.95, 1.6, u);
      const br = Math.sin(zP(t, 4)); F.br = br;                    // breathing: four breaths a loop
      const hy = -0.8 * br, hr = 0.4 * br; F.hy = hy;
      // the blink (0.3 s)
      F.lid = t < 0.2 ? 0 : t < 0.29 ? sstep(0.2, 0.29, t) : t < 0.34 ? 1 : 1 - sstep(0.34, 0.47, t);
      // what the eyes are watching: the sky, the shooting star, the firefly
      const M = c0Meteor(t), Vf = c0Visitor(t); F.M = M; F.Vf = Vf;
      const wS = sstep(0.55, 0.8, t) * (1 - sstep(1.35, 1.95, t));
      const wF = Vf ? (t < 6 ? sstep(1.65, 2.05, t) * (1 - sstep(3.0, 3.5, t)) : sstep(12.75, 13.15, t) * (1 - sstep(14.15, 14.65, t))) : 0;
      const sp = M ? [M[0], M[1]] : t < 1 ? C0S0 : C0S1;
      F.wS = wS; F.wF = wF;
      F.mouth = t > 0.78 && t < 1.72 ? 1 : 0;                       // a small "oh" at the shooting star
      F.blush = 0.42 + 0.3 * wF;
      c0Np = 0; C0BB[0] = 1e9; C0BB[1] = 1e9; C0BB[2] = -1e9; C0BB[3] = -1e9;
      // the foot (a round tail to the front), the neck out of the shell's mouth, the chest rising into the round head
      c0Prim(-95, 61.4, -46, 59.8, 6.4, 9, 3, 0);
      c0Prim(-46, 59.8, 40, 58.4, 9, 10.2, 1, 0);
      c0Prim(40, 58.4, 124, 58.4, 10.2, 9.6, 1, 0);
      c0Prim(26, 45, 92, 36 + hy * 0.4, 12, 16.5, 8, 1);
      c0Prim(113, 56, 119, 38 + hy * 0.7, 16.5, 20 + hr, 8, 1);
      c0Prim(122, 31 + hy, 122, 31 + hy, 23.5 + hr, 23.5 + hr, 8, 2);
      // the lower tentacles, small, under the smile
      c0Prim(137, 50 + hy * 0.6, 145, 56.5 + 0.7 * Math.sin(zP(t, 3) + 1), 3.4, 2.8, 2.6, 3);
      c0Prim(141.5, 46.5 + hy * 0.6, 149.5, 51.5 + 0.6 * Math.sin(zP(t, 3) + 2.4), 2.9, 2.4, 2.4, 3);
      // the eyestalks: a gentle sway, and a lean toward whatever they're watching
      const stalk = (E, base, ctrl, sw1, sw2, ph, idE, EA) => {
        let gx = -0.45, gy = -0.89;
        const tx = E[0] + sw1 * Math.sin(zP(t, 2) + ph), ty = E[1] + sw2 * Math.sin(zP(t, 3) + ph * 1.7);
        if (wS > 0) { const [dx, dy] = c0Nrm(sp[0] - tx, sp[1] - ty); gx += (dx - gx) * wS; gy += (dy - gy) * wS; }
        if (wF > 0) { const [dx, dy] = c0Nrm(Vf[0] - tx, Vf[1] - ty); gx += (dx - gx) * wF; gy += (dy - gy) * wF; }
        const [nx, ny] = c0Nrm(gx, gy), lean = 5.5 * Math.max(wS, wF);
        const tip = [tx + nx * lean, ty + ny * lean + 0.6 * hy], b = [base[0], base[1] + hy], c = [ctrl[0] + nx * lean * 0.5, ctrl[1] + ny * lean * 0.5 + hy * 0.8];
        const N = 7;
        let p0 = b;
        for (let k = 1; k <= N; k++) {
          const p1 = c0Bz(b, c, tip, k / N * 0.88);
          c0Prim(p0[0], p0[1], p1[0], p1[1], lerp(5.7, 3.8, (k - 1) / N), lerp(5.7, 3.8, k / N), k === 1 ? 5 : 0.4, 4, (k - 1) / N, k / N);
          p0 = p1;
        }
        const rb = 10.6 + 0.5 * wS;
        c0Prim(tip[0], tip[1], tip[0], tip[1], rb, rb, 2.4, idE);
        EA.x = tip[0]; EA.y = tip[1]; EA.rb = Math.max(rb, F.mr); EA.re = 7.1 + 0.5 * wS;
        EA.ex = tip[0] + nx * 2.6; EA.ey = tip[1] + ny * 2.6;
      };
      stalk(C0EA, [112, 14], [118, -32], 2.4, 1.3, 0, 5, F.EA);
      stalk(C0EB, [130, 15], [152, -24], 2.1, 1.2, 1.1, 6, F.EB);
    }

    /* ---------------------------------------------------------------- the sky, the meadow, the stem */
    const C0AE = new Float32Array(W), C0AQ = new Float32Array(W), C0MF = new Float32Array(W), C0MS = new Float32Array(W);
    const C0GN = 400, C0GX = new Float32Array(C0GN), C0GH = new Float32Array(C0GN), C0GL = new Float32Array(C0GN), C0GC = new Uint8Array(C0GN), C0GT = new Uint8Array(C0GN);
    let c0Gj0 = 0;
    function c0Sky(V, t) {
      const u = V.u, b = V.box, X0 = b[0], X1 = b[2], Y0 = Math.max(b[1], c0ROW0), Y1 = Math.min(b[3], c0ROW1);
      // the night
      for (let Y = Y0; Y <= Y1; Y++) BUF.fill(135, Y * W + X0, Y * W + X1 + 1);
      // the aurora, column by column: where its lower hem hangs (C0AE) and how bright its rays are there (C0AQ)
      for (let X = X0; X <= X1; X++) {
        const x = (X + 0.5 - 240) / u, env = sstep(-236, -184, x) * (1 - sstep(-110, -30, x));   // (nothing of it reaches the seam)
        if (env <= 0) continue;
        const hem = -58 - 0.24 * (x + 220) + 6 * Math.sin(x * 0.021 + zP(t, 1)) + 2.5 * Math.sin(x * 0.067 - zP(t, 2));
        const r = 0.5 + 0.5 * Math.sin(x * 0.09 + 2.2 * Math.sin(x * 0.023 + zP(t, 1)) + zP(t, 1)), r2 = 0.5 + 0.5 * Math.sin(x * 0.31 - 1.3 * Math.sin(x * 0.05 - zP(t, 2)) + zP(t, 3));
        const aq = env * (0.42 + 0.38 * r + 0.2 * r2) * (0.78 + 0.22 * Math.sin(x * 0.7 + 3 * Math.sin(x * 0.05 + zP(t, 1)))) * 0.82;
        const Ye = Math.min(Y1, fl(V.Y(hem + 6)));
        for (let Y = Math.max(Y0, fl(V.Y(-150))); Y <= Ye; Y++) {
          const y = (Y + 0.5 - 135) / u, d = hem - y;
          const p = d < 0 ? (1 + d / 6) * (1 + d / 6) : Math.exp(-d / 30) * Math.min(1, 0.5 + d * 0.22), A = p * aq * sstep(-136, -98, y);
          if (A > 0.04) BUF[Y * W + X] = c0Rp(bay(X + 4, Y + 2) < sstep(6, 40, d) ? C0AUC : C0AUG, A * 5, X, Y);
        }
      }
      // the shell's glow on the sky around it
      c0Ann(V, 62.4, 90, (x, y, X, Y) => {
        if (BUF[Y * W + X] !== 135) return -1;
        const dx = x - c0SX, dy = y - c0SY, f = (90 - Math.sqrt(dx * dx + dy * dy)) / 20;
        return bay(X, Y) < 0.3 * f * f ? 136 : -1;
      });
      // the stem, straight down from the flower
      const sh = Math.max(0.5 / u, 3.5);
      c0Each(V, 24 - sh, 88, 24 + sh, 420, (x, y) => {
        const q = (x - 24) / sh, dk = y > 156 ? 1 : 0;
        return q < -0.68 ? 140 : q < -0.2 ? 143 - dk : q < 0.36 ? 142 - dk : q < 0.7 ? 141 - dk : 140;
      });
      // the meadow: per column its ragged top and the wind's lean; per blade its foot, height and curl
      if (V.Y(118) > Y1) return;
      for (let X = X0; X <= X1; X++) { const x = (X + 0.5 - 240) / u; C0MF[X] = 153 + 1.7 * Math.sin(x * 0.081 + 1.3) + 1.2 * Math.sin(x * 0.23 + 0.4); C0MS[X] = 0.10 * Math.sin(zP(t, 2) + x * 0.029) + 0.05 * Math.sin(zP(t, 3) - x * 0.07); }
      c0Gj0 = fl(Math.max(-420, V.lx(X0)) / 2.3) - 4;
      const jn = Math.min(C0GN, fl(Math.min(420, V.lx(X1)) / 2.3) + 4 - c0Gj0 + 1);
      for (let i = 0; i < jn; i++) {
        const j = c0Gj0 + i, r1 = ih(j, 1, 563), r2 = ih(j, 2, 563), r3 = ih(j, 3, 563);
        C0GH[i] = 2.5 + r1 * r1 * 15 + (r1 > 0.94 ? 15 : 0); C0GX[i] = (j + 0.5 + (r2 - 0.5) * 0.8) * 2.3; C0GL[i] = (r3 - 0.5) * 6;
        C0GC[i] = r2 < 0.45 ? 140 : 139; C0GT[i] = r3 > 0.72 && u > 0.3 ? 1 : 0;
      }
      const mw = 0.55 / u;
      c0Each(V, -420, 118, 420, 420, (x, y, X, Y) => {
        const hg = C0MF[X] - y;
        if (hg > 34) return -1;
        if (hg <= 0) {                                              // the meadow's depths: grass in shadow, streaked
          const k = ih(fl(x / 1.7), fl((y + 3 * Math.sin(x * 0.7)) / 4.5), 561), v = 1.55 + hg / 30 + (k - 0.5) * 1.3;
          return v > 1.8 ? 140 : v > 0.5 ? 139 : 23;
        }
        const xs = x - C0MS[X] * hg, k = fl(xs / 2.3) - c0Gj0;      // blades, leaning and swaying
        for (let i = Math.max(0, k - 2); i <= Math.min(jn - 1, k + 2); i++) {
          const hb = C0GH[i]; if (hg >= hb) continue;
          const f = hg / hb, bx = C0GX[i] + C0GL[i] * f * f, wb = Math.max(1.2 * (1 - f) + 0.2, mw);
          if (Math.abs(xs - bx) < wb) return f > 0.66 && C0GT[i] ? 141 : C0GC[i];
        }
        return -1;
      });
    }
    // flower silhouettes standing out of the grass: bellflowers, dandelion clocks, a bud
    const C0WEED = [[-188, 33, 0], [-136, 24, 1], [-96, 15, 2], [-46, 19, 0], [88, 27, 0], [124, 17, 2], [156, 37, 1], [204, 21, 0]];
    function c0Weeds(V, t) {
      const u = V.u; if (V.Y(110) > c0ROW1) return;
      const mw = Math.max(0.7, 0.55 / u);
      for (let k = 0; k < C0WEED.length; k++) {
        const [bx, h, kind] = C0WEED[k], top = 154 - h, sw = 1.6 * Math.sin(zP(t, 1) + k * 1.7) + 0.6 * Math.sin(zP(t, 3) + k), tx = bx + sw + (kind === 0 ? 3 : 0);
        const hr = kind === 1 ? 4.6 : kind === 0 ? 3.4 : 2.2;
        c0Each(V, Math.min(bx, tx) - hr - 1, top - hr - 1, Math.max(bx, tx) + hr + 1, 158, (x, y, X, Y) => {
          // the stem (curving over at the top for a bell)
          const q = clamp((156 - y) / (156 - top), 0, 1), sx = bx + (tx - bx) * q * q;
          if (y > top && Math.abs(x - sx) < mw) return 140;
          const dx = x - tx, dy = y - top;
          if (kind === 1) { const d2 = dx * dx + dy * dy; if (d2 < hr * hr) { if (d2 < 1.2) return 140; return bay(X, Y) < 0.34 * (1 - d2 / (hr * hr)) + 0.06 ? (d2 > hr * hr * 0.6 ? 19 : 138) : -1; } return -1; }
          if (kind === 0) { const ey = dy - 2.2; if (ey > -2.6 && ey < 2.8 && Math.abs(dx) < 2.2 + 0.5 * ey) return ey > 2 && c0Ev(x) ? 141 : 139; return -1; }
          const e2 = dx * dx / 2.2 + dy * dy / 9; return e2 < 1 ? (dx < -0.6 ? 141 : 139) : -1;
        });
      }
    }
    const c0Ev = (x) => (fl(x) & 1) === 0;
    function c0Stars(V, t) {
      const u = V.u, cs = 15, keep = u >= 1 ? 1 : u * u * 1.15, hx = 240 / u + cs, hy = 135 / u + cs;
      const i0 = Math.max(-28, fl(-hx / cs)), i1 = Math.min(28, Math.ceil(hx / cs)), j0 = Math.max(-28, fl(-hy / cs)), j1 = Math.min(10, Math.ceil(hy / cs));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (ih(i, j, 571) > keep) continue;
        const x = (i + ih(i, j, 572)) * cs, y = (j + ih(i, j, 573)) * cs;
        if (y > 136 || y < -420 || x < -420 || x > 420) continue;
        const dx = x - c0SX, dy = y - c0SY; if (dx * dx + dy * dy < 4900) continue;
        const X = fl(V.X(x)), Y = fl(V.Y(y)); if (X < 0 || X >= W || Y < c0ROW0 || Y > c0ROW1) continue;
        const b = ih(i, j, 574), tw = 0.5 + 0.5 * Math.sin(zP(t, 1 + fl(ih(i, j, 575) * 4)) + 6.28 * ih(i, j, 576)), lv = b * b * (0.55 + 0.45 * tw);
        P(X, Y, lv > 0.62 ? 22 : lv > 0.4 ? 21 : lv > 0.22 ? 20 : lv > 0.1 ? 19 : 138);
        if (lv > 0.62 && ih(i, j, 577) < sstep(0.5, 0.95, u)) { P(X - 1, Y, 19); P(X + 1, Y, 19); P(X, Y - 1, 19); P(X, Y + 1, 19); }
      }
    }
    function c0Shoot(V, M) {
      if (!M) return;
      const [hx, hy, b, p] = M, u = V.u, dx = C0S1[0] - C0S0[0], dy = C0S1[1] - C0S0[1], dl = Math.hypot(dx, dy), ux = dx / dl, uy = dy / dl;
      const Lt = 88 * b * Math.min(1, p * 4), n = Math.ceil(V.S(Lt) * 1.6);
      for (let k = n; k >= 0; k--) {
        const f = k / Math.max(1, n), X = fl(V.X(hx - ux * Lt * f)), Y = fl(V.Y(hy - uy * Lt * f)), lv = (1 - f) * b;
        if (Y < c0ROW0 || Y > c0ROW1 || bay(X, Y) > lv * 1.5 + 0.04) continue;
        P(X, Y, lv > 0.8 ? 22 : lv > 0.6 ? 21 : lv > 0.4 ? 20 : lv > 0.22 ? 147 : 138);
        if (u >= 0.8 && lv > 0.7) P(X, Y - 1, 147);
      }
      const X = V.X(hx), Y = V.Y(hy);
      glow(X, Y, Math.max(4, 11 * u), T_WH, 0.55 * b);
      if (b > 0.3) sparkle(X, Y, Math.max(1, 2.4 * u * b), 22, 147);
    }

    /* ---------------------------------------------------------------- the flower: a night lotus */
    // a petal's half-width along it (q: 0 at the base, 1 at the tip): round at the foot, broad, coming to a point
    const C0PF = new Float32Array(258);
    { let m = 0; for (let i = 0; i <= 256; i++) { const q = i / 256; C0PF[i] = Math.sqrt(q) * Math.pow(1 - q, 0.7); m = Math.max(m, C0PF[i]); } for (let i = 0; i <= 256; i++) C0PF[i] /= m; C0PF[257] = 0; }
    // petals: foot (bx, by), tip (tx, ty), half-width, bow, face (1 inner/lit, 0 outer), tone at the foot, gain to the tip, row
    const c0Pt = (bx, by, tx, ty, w, bend, inn, t0, tg, ph, row) => ({ bx, by, tx, ty, w, bend, inn, t0, tg, ph, row });
    const C0PETS = [
      // the back row: a crown of points rising behind the snail (past the tail, beside the shell, over the neck, past the face)
      c0Pt(6, 106, -116, 40, 17, 0.12, 1, 0.3, 2.9, 0.2, 0), c0Pt(12, 104, -94, 24, 16, 0.08, 1, 0.2, 2.8, 1.1, 0),
      c0Pt(40, 106, 172, 38, 17, -0.12, 1, 0.3, 2.9, 2.6, 0),
      // the great side petals that make the cup
      c0Pt(10, 110, -126, 64, 20, 0.14, 1, 0.6, 3.6, 2.9, 1), c0Pt(38, 110, 170, 64, 20, -0.14, 1, 0.6, 3.6, 3.7, 1),
      c0Pt(14, 110, -96, 58, 21, 0.08, 1, 0.5, 3.4, 4.4, 1), c0Pt(34, 110, 142, 58, 21, -0.08, 1, 0.5, 3.4, 5.2, 1),
      // the cup's inner petals, under the snail (they fill the flower's heart)
      c0Pt(18, 110, -46, 63, 22, 0.05, 1, 0.4, 3.0, 0.9, 1), c0Pt(30, 110, 98, 63, 22, -0.05, 1, 0.4, 3.0, 1.9, 1), c0Pt(24, 110, 26, 61, 24, 0, 1, 0.4, 3.0, 2.8, 1),
      // the outermost, lowest petals, opening out and down (we see their outer faces)
      c0Pt(16, 113, -70, 112, 9, -0.2, 0, 0.6, 2.8, 5.9, 2), c0Pt(32, 113, 118, 112, 9, 0.2, 0, 0.6, 2.8, 0.6, 2),
      // the front row, in front of the snail's foot (their points just over the sole)
      c0Pt(16, 114, -68, 63, 19, 0.07, 1, 1.1, 4.3, 1.6, 3), c0Pt(32, 114, 108, 63, 19, -0.07, 1, 1.1, 4.3, 4.0, 3),
      c0Pt(22, 115, -12, 61, 18, 0.03, 1, 1.3, 4.4, 2.4, 3), c0Pt(28, 115, 54, 61, 18, -0.03, 1, 1.3, 4.4, 3.1, 3),
    ];
    const C0LEAVES = [{ a: -0.33, L: 40, w: 5.5, bend: -0.1, bx: 26.5, by: 131, ph: 0.4 }, { a: -2.86, L: 34, w: 4.6, bend: 0.1, bx: 21.5, by: 145, ph: 2.1 }];
    function c0Petal(V, P, t) {
      const u = V.u, tx = P.tx + 1.3 * Math.sin(zP(t, 1) + P.ph), ty = P.ty + 0.9 * Math.sin(zP(t, 2) + P.ph * 1.3);
      const dx0 = tx - P.bx, dy0 = ty - P.by, L = Math.hypot(dx0, dy0), ca = dx0 / L, sa = dy0 / L, nx = -sa, ny = ca, w = P.w, bw = P.bend * L;
      const ol = u >= 0.3 ? Math.max(0.8, 1 / u) : 0, olf = clamp((u - 0.3) / 0.12, 0, 1), mw = 0.55 / u, lv = sstep(0.55, 0.95, u), R = P.inn ? C0PIN : C0POU, rim = P.inn ? 57 : 138, shade = P.row < 3;
      // its bounds: the bowed axis, widened by the half-width
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k <= 6; k++) { const q = k / 6, o = bw * (q * q - q), cx = P.bx + ca * L * q + nx * o, cy = P.by + sa * L * q + ny * o, ww = w * C0PF[fl(q * 256)] + 1; x0 = Math.min(x0, cx - ww); x1 = Math.max(x1, cx + ww); y0 = Math.min(y0, cy - ww); y1 = Math.max(y1, cy + ww); }
      c0Each(V, x0, y0, x1, y1, (x, y, X, Y) => {
        const px = x - P.bx, py = y - P.by, s = px * ca + py * sa; if (s <= 0 || s >= L) return -1;
        const q = s / L, v = px * nx + py * ny - bw * (q * q - q), f = Math.max(w * C0PF[fl(q * 256)], mw), av = Math.abs(v);
        if (av >= f) return -1;
        const ed = (f - av) * (1 - 0.4 * q * q);                     // how far in from the edge, roughly
        if (ed < ol && (olf >= 1 || bay(X, Y) < olf)) return q > 0.14 ? rim : R[1];   // the pale rim (it glows a little)
        const sc = v / f, gdx = x - c0SX, gdy = y - c0SY, ig = clamp(1 - (Math.sqrt(gdx * gdx + gdy * gdy) - 64) / 80, 0, 1);
        let tv = P.t0 + P.tg * q + 0.6 * (1 - sc * sc) + 1.5 * ig * ig;
        if (lv > 0 && q > 0.06 && q < 0.93) { const vs = sc * 3.5 + 3.5, fv = vs - fl(vs); if (fv < 0.12 || fv > 0.88) tv += (P.inn ? 0.75 : 0.5) * lv; }   // veins, fanning to the tip
        if (ed < ol + 1.8 && q > 0.2) tv += 1.0;                    // the rim's inner glow
        if (q > 0.86) tv += 0.6;
        if (shade && y > 62 && y < 86 && x > -100 && x < 140) tv -= 1.3 * (1 - (y - 62) / 24);   // the snail's shadow
        return c0Rq(R, tv, X, Y, 0.7);
      });
    }
    // the lotus's golden heart: stamens standing round the snail's sole, glinting between the front petals
    function c0Stamens(V, t) {
      const u = V.u; if (u < 0.5) return;
      for (let k = 0; k < 30; k++) {
        const x = -60 + k * 6.2 + 3 * ih(k, 1, 631), top = 65.5 + 4 * ih(k, 2, 631), lean = (ih(k, 3, 631) - 0.5) * 4 + 0.8 * Math.sin(zP(t, 2) + k);
        const X0 = V.X(x + lean * 0.6), Yb = V.Y(top + 3.2), Yt = V.Y(top), Xt = V.X(x + lean);
        if (Yt > c0ROW1) continue;
        if (u >= 0.8) lineP(X0, Yb, Xt, Yt, 131);
        const tw = 0.5 + 0.5 * Math.sin(zP(t, 1 + (k % 3)) + k * 2.1), c = tw > 0.75 ? 16 : tw > 0.35 ? 15 : 58;
        if (u >= 1.3) { discF(Xt, Yt, 0.9 * u, 58); discF(Xt - 0.2 * u, Yt - 0.2 * u, 0.55 * u, c); } else { P(Xt, Yt, c); if (u >= 0.9) P(Xt + 1, Yt, 58); }
      }
    }
    // dew on a front petal: a bead of light that twinkles now and then
    function c0Dew(V, Pt, t, k) {
      const u = V.u; if (u < 0.45) return;
      const tx = Pt.tx + 1.3 * Math.sin(zP(t, 1) + Pt.ph), ty = Pt.ty + 0.9 * Math.sin(zP(t, 2) + Pt.ph * 1.3);
      const dx0 = tx - Pt.bx, dy0 = ty - Pt.by, L = Math.hypot(dx0, dy0), ca = dx0 / L, sa = dy0 / L, bw = Pt.bend * L;
      for (let j = 0; j < 2; j++) {
        const q = 0.5 + 0.22 * ih(k, j, 611), sc = (ih(k, j, 612) - 0.5) * 0.9, sv = sc * Pt.w * C0PF[fl(q * 256)] + bw * (q * q - q);
        const x = Pt.bx + ca * L * q - sa * sv, y = Pt.by + sa * L * q + ca * sv, X = V.X(x), Y = V.Y(y);
        if (Y < c0ROW0 || Y > c0ROW1) continue;
        const tw = Math.max(0, Math.sin(zP(t, 2 + fl(ih(k, j, 613) * 3)) + ih(k, j, 614) * 6.28));
        if (u >= 1.1) { discF(X, Y, 0.9 * u, 147); discF(X - 0.2 * u, Y + 0.15 * u, 0.55 * u, 138); }
        P(X - (u >= 1.1 ? 0.35 * u : 0), Y - (u >= 1.1 ? 0.35 * u : 0), tw > 0.5 || u >= 1.1 ? 22 : 148);
        if (tw > 0.85) sparkle(X - 0.3 * u, Y - 0.3 * u, Math.max(1, 1.6 * u * (tw - 0.85) / 0.15), 22, 148);
      }
    }
    // pollen: golden motes lifting off the flower and drifting up, each on its own cycle (whole turns of the loop)
    function c0Pollen(V, t) {
      const u = V.u; if (u < 0.3) return;
      for (let k = 0; k < 11; k++) {
        const n = 1 + (k % 3 === 0 ? 1 : 0), ph = frac(t * n / ZD + ih(k, 1, 621)), b = Math.sin(PI * ph);
        const x = -70 + 190 * ih(k, 2, 621) + 9 * Math.sin(ph * 7 + k) + 14 * ph * (ih(k, 3, 621) - 0.5), y = 70 - 95 * ph;
        const dx = x - c0SX, dy = y - c0SY; if (dx * dx + dy * dy < 4900 || b < 0.15) continue;
        const X = V.X(x), Y = V.Y(y); if (Y < c0ROW0 || Y > c0ROW1) continue;
        P(X, Y, b > 0.7 ? 59 : b > 0.4 ? 15 : 131);
      }
    }
    function c0Leaf(V, P, t) {
      const u = V.u, a = P.a + 0.05 * Math.sin(zP(t, 1) + P.ph), ca = Math.cos(a), sa = Math.sin(a), L = P.L, w = P.w, bend = P.bend;
      const nx = -sa, ny = ca, ol = u >= 0.42 ? Math.max(0.8, 1 / u) : 0, mw = 0.55 / u;
      const tx = P.bx + ca * L + nx * bend * L, ty = P.by + sa * L + ny * bend * L;
      c0Each(V, Math.min(P.bx, tx) - w - 1, Math.min(P.by, ty) - w - 1, Math.max(P.bx, tx) + w + 1, Math.max(P.by, ty) + w + 1, (x, y, X, Y) => {
        const px = x - P.bx, py = y - P.by, s = px * ca + py * sa; if (s <= 0 || s >= L) return -1;
        const q = s / L, v = px * nx + py * ny - bend * s * q, wf = Math.max(w * 2.6 * Math.sqrt(q) * (1 - q), mw), av = Math.abs(v);
        if (av >= wf) return -1;
        if ((wf - av) * (1 - 0.35 * q) < ol) return 140;
        if (av < Math.max(0.45, 0.5 / u) && q < 0.9) return 141;
        return c0Rp(C0LEAF, (v < 0 ? 3.1 : 2.2) - q * 0.6 + (u >= 0.8 && ((s * 0.35 + av * 0.5) % 2.4) < 0.4 ? 0.6 : 0), X, Y);
      });
    }

    /* ---------------------------------------------------------------- the snail */
    // a tile (64 units, periodic, at half-unit steps) of soft mottling for the glass and of tiny bright flecks in it
    const C0TX = new Float32Array(128 * 128), C0FK = new Uint8Array(128 * 128);
    {
      const h = (p, q) => ih(p & 7, q & 7, 547);
      for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) {
        const gx = i / 16, gy = j / 16, a = fl(gx), b = fl(gy), fx = gx - a, fy = gy - b, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
        C0TX[j * 128 + i] = lerp(lerp(h(a, b), h(a + 1, b), ux), lerp(h(a, b + 1), h(a + 1, b + 1), ux), uy) - 0.5;
      }
      for (let cj = 0; cj < 20; cj++) for (let ci = 0; ci < 20; ci++) {
        if (ih(ci, cj, 551) < 0.94) continue;
        const fx = (ci + ih(ci, cj, 552)) * 6.4, fy = (cj + ih(ci, cj, 553)) * 6.4;
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (di * di + dj * dj <= 2) C0FK[((fl(fy) + dj) & 127) * 128 + ((fl(fx) + di) & 127)] = 1 + fl(ih(ci, cj, 554) * 253);
      }
    }
    function c0Skin(x, y, X, Y, s) {
      const F = c0F, depth = -s, id = c0Sid, rl = c0Srl, al = c0Sal;
      if (depth < F.ol && (F.olf >= 1 || bay(X, Y) < F.olf)) return 124;
      // the surface's lean, from the field's gradient
      const gl = Math.sqrt(c0Gx * c0Gx + c0Gy * c0Gy) || 1, rel = clamp(depth / rl, 0, 1), m = 1 - rel;
      const nx = c0Gx / gl * m, ny = c0Gy / gl * m, nz = Math.sqrt(Math.max(0, 1 - m * m));
      const lamS = Math.max(0, -0.25 * nx - 0.8 * ny + 0.55 * nz);   // the sky, from above
      const gdx = c0SX - x, gdy = c0SY - y, gd2 = gdx * gdx + gdy * gdy;
      let lamG = 0;                                                  // the galaxy in the shell
      if (gd2 < 16384) { const gd = Math.sqrt(gd2), ig = 1 - (gd - 64) / 64; lamG = Math.max(0, (gdx * nx + gdy * ny) / gd * 0.85 + 0.3 * nz) * ig * ig; }
      // sea glass: dim at the skin, glowing in its depths, lit from above and by the galaxy; its thin underside edge glows too
      let v = 0.6 + 1.35 * Math.sqrt(rel) + 1.45 * lamS + 2.0 * lamG + (rel > 0.62 ? (rel - 0.62) * 1.6 : 0);
      if (depth < F.ol + 1.5 && ny > 0.25 && id <= 2) v += 0.9;
      // the eyes
      if (id >= 5) {
        const E = id === 5 ? F.EA : F.EB, ex = x - E.ex, ey = y - E.ey, re = E.re, d2 = ex * ex + ey * ey, lidY = E.ey - re - 0.6 + F.lid * 2.4 * re;
        if (F.lid >= 0.6) { const ax = x - E.x, ay = y - (E.y - 0.5 * re), ad = Math.sqrt(ax * ax + ay * ay); if (ay > 0.2 * re && Math.abs(ad - re * 0.9) < Math.max(0.65, 0.7 / F.u)) return 124; }
        else if (F.lid > 0 && Math.abs(y - lidY) < Math.max(0.6, 0.7 / F.u) && d2 < (re + 0.9) * (re + 0.9)) return 124;
        if (F.lid < 0.6 && y > lidY && d2 < re * re) {
          if (F.u < 0.3) return 1;
          const de = Math.sqrt(d2) / re, cx = x - E.x, cy = y - E.y;
          const h1x = cx + 0.3 * re, h1y = cy + 0.36 * re, h1 = (h1x * h1x + h1y * h1y) / (re * re);
          if (h1 < 0.1) return h1 < 0.05 ? 22 : 21;                  // the catchlight (the sky)
          const h2x = cx - 0.36 * re, h2y = cy - 0.3 * re;
          if (h2x * h2x + h2y * h2y < Math.max(0.022 * re * re, 0.3 / (F.u * F.u))) return 21;
          const h3x = cx + 0.44 * re, h3y = cy - 0.28 * re;
          if (F.lod && h3x * h3x + h3y * h3y < 0.016 * re * re) return 15;   // a warm glint: the galaxy, reflected
          if (de > 0.87) return 124;
          const lo = ey / re;
          return lo > 0.15 ? c0Rp([1, 2, 3, 4, 5, 6], (lo - 0.15) * 5.5 * (1 - de * 0.5), X, Y) : de < 0.42 && F.lod > 1 ? 0 : 1;
        }
      }
      // the face: a small smile (or an "oh"), rosy cheeks
      if (id === 2 || id === 1) {
        const fy = y - F.hy, lw = Math.max(0.72, 0.6 / F.u);
        if (x > 126 && x < 146 && fy > 32 && fy < 50) {
          if (F.mouth) { const mx = x - 135.2, my = fy - 44.0, md = mx * mx * 1.2 + my * my * 0.8; if (md < 6.6) return md < 2.8 ? (my > 0.4 ? 125 : 1) : 124; }
          else { const mx = x - 134.8, my = fy - 40.2, md = Math.sqrt(mx * mx + my * my); if (my > 1.0 && Math.abs(md - 3.4) < lw) return 124; }
        }
        const bx = (x - 125.2) / 4.8, by = (fy - 40.0) / 2.7, b2 = bx * bx + by * by;
        if (b2 < 1 && F.u > 0.35) { const bb = bay(X, Y); if (b2 < 0.45 + 0.35 * (F.blush - 0.42)) return F.u > 0.7 ? 44 : 37; if (bb < 0.55 * (1.15 - b2)) return bb < 0.2 ? 44 : 37; }
      }
      if (id === 4) v += 0.3 * al;                                   // the stalks grow clearer toward the eyes
      // texture: a mottled glass, faint creases round the stalks, tiny bright flecks
      if (F.tex > 0 && id <= 4) {
        const ti = ((fl(y * 2) & 127) << 7) | (fl(x * 2) & 127);
        if (C0FK[ti] && C0FK[ti] < F.fk && rel > 0.15 && -0.14 * nx - 0.45 * ny + 0.88 * nz < 0.93) return 128;
        v += C0TX[ti] * 0.45 * F.tex;
        if (id === 4) { const r = al * 22, fr = r - fl(r); if (fr < 0.16 && rel < 0.85) v -= 0.5 * F.tex; }
      }
      // the foot's pale, softly scalloped skirt, and the shadow the shell lays on the body
      if (id === 0 && y > 65.3 + 0.5 * Math.sin(x * 0.55)) v = 2.6 + (F.lod && (((x * 0.2) % 1) + 1) % 1 < 0.12 ? -0.9 : 0);
      if (id <= 1) { const sdx = x - c0SX; if (Math.abs(sdx) < 74) { const dd = y - (c0SY + Math.sqrt(74 * 74 - sdx * sdx)); if (dd < 8) v -= 1.3 * (1 - Math.max(0, dd) / 8); } }
      // a wet gloss where it faces the sky, and the shell's warm light on the near edge
      const sp = -0.14 * nx - 0.45 * ny + 0.88 * nz;
      if (sp > 0.95 && rel > 0.05) { v += (sp - 0.95) * (id >= 2 ? 36 : 16); if (sp > 0.992 && id >= 2) return 129; }
      if (lamG > 0.4 && depth < F.ol + 1.4 && bay(X, Y) < lamG) return 144;
      return c0Rq(C0GRN, v, X, Y, 0.55);
    }
    function c0Snail(V) {
      const u = V.u, b = V.box, P = C0PR;
      const Y0 = Math.max(b[1], c0ROW0, fl(V.Y(C0BB[1]))), Y1 = Math.min(b[3], c0ROW1, Math.ceil(V.Y(C0BB[3])));
      for (let Y = Y0; Y <= Y1; Y++) {
        const y = (Y + 0.5 - 135) / u;
        // the primitives that reach this row, and the span they cover
        let na = 0, xa = 1e9, xb = -1e9;
        for (let i = 0, o = 0; i < c0Np; i++, o += C0ST) {
          if (y < P[o + 9] || y > P[o + 11]) continue;
          // the part of the segment within reach of this row, widened by the reach: a tighter span than the box
          const R = P[o + 10] - Math.max(P[o], P[o + 2]), ay = P[o + 1], dy = P[o + 15];
          let h0 = 0, h1 = 1;
          if (Math.abs(dy) > 1e-6) { const ha = (y - R - ay) / dy, hb = (y + R - ay) / dy; h0 = Math.max(0, Math.min(ha, hb)); h1 = Math.min(1, Math.max(ha, hb)); }
          const xa0 = P[o] + P[o + 14] * h0, xa1 = P[o] + P[o + 14] * h1;
          C0AX0[na] = Math.min(xa0, xa1) - R; C0AX1[na] = Math.max(xa0, xa1) + R; C0ACT[na] = o;
          if (C0AX0[na] < xa) xa = C0AX0[na]; if (C0AX1[na] > xb) xb = C0AX1[na]; na++;
        }
        if (!na) continue;
        c0Skip(u, y, 62.4); const S0 = C0SK[0], S1 = C0SK[1], o = Y * W;
        const X0 = Math.max(b[0], fl(V.X(xa))), X1 = Math.min(b[2], Math.ceil(V.X(xb)));
        for (let X = X0; X <= X1; X++) {
          if (X >= S0 && X <= S1) { X = S1; continue; }
          const x = (X + 0.5 - 240) / u, s = c0Field(x, y, na);
          // outside: the field never changes faster than distance, so nothing of the body is nearer than s (up to the margin)
          if (s >= 0) { const sk = fl((Math.min(s, 6) - 0.6) * u); if (sk > 0) X += sk; continue; }
          BUF[o + X] = c0Skin(x, y, X, Y, s);
        }
      }
    }

    /* ---------------------------------------------------------------- the shell's rim: amber horn */
    const C0THS = 0.22;                                              // where the suture meets the rim (just above the aperture)
    // by angle round the rim (2048 steps): the growth lines' wander, and the aperture's flare
    const C0RW = new Float32Array(2050), C0RF = new Float32Array(2050);
    for (let i = 0; i <= 2049; i++) { const th = i / 2048 * TAU - PI, g = (th - 0.72) / 0.5; C0RW[i] = 0.9 * Math.sin(th * 7 + 1.3) + 0.5 * Math.sin(th * 23); C0RF[i] = g > -1 && g < 1 ? (1 - g * g) * (1 - g * g) : 0; }
    function c0Rim(V) {
      const u = V.u, ol = Math.max(0.8, 1 / u), mw = 1.4 / u, nl = u >= 0.5 ? 180 : 0, na = sstep(0.5, 1.0, u), gl = 0.2 * sstep(1.2, 1.8, u), lw = Math.max(0.55, 0.6 / u);
      c0Ann(V, 62.4, 64 + 12.5 + ol + 1 + mw, (x, y, X, Y) => {
        const dx = x - c0SX, dy = y - c0SY, r = Math.sqrt(dx * dx + dy * dy), rho = r - 64, th = Math.atan2(dy, dx), cs = dx / r, sn = dy / r;
        let ph = C0THS - th; if (ph < 0) ph += TAU;                  // how far round the last whorl, from the suture
        const ti = fl((th + PI) * (2048 / TAU)), fa = C0RF[ti];          // the aperture's flared lip
        const wR = Math.max(6 + 2.2 * ph / TAU + 4.2 * fa, mw);
        if (rho > wR + ol) return -1;
        if (rho > wR) return 130;
        if (rho < 0.4) return rho < -0.5 ? 130 : 131;                // the groove where the horn meets the window
        // the horn's rounded cross-section: its normal turns from facing the galaxy (inner edge) to facing out
        const n = rho / wR, nr = clamp((n - 0.42) * 1.9, -1, 1), nz = Math.sqrt(1 - nr * nr);
        const glowG = Math.exp(-(rho - 0.4) / 2.1);                  // the galaxy shining through the horn's inner edge
        const lamS = Math.max(0, -0.3 * cs * nr - 0.85 * sn * nr + 0.42 * nz);   // the sky, from above
        const spec = Math.max(0, -0.17 * cs * nr - 0.48 * sn * nr + 0.86 * nz);  // its gloss (top left, and low right)
        let v = 0.75 + 3.3 * glowG + 1.15 * lamS - (sn > 0.3 ? (sn - 0.3) * 1.1 : 0);
        // the spiral bands of colour that run along the whorl
        if (n > 0.5 && n < 0.61) v -= 0.6; else if (n > 0.76 && n < 0.83) v += 0.35;
        // growth lines: fine ridges across the horn, irregularly spaced, every seventh a little stronger
        if (nl) { const w = th / TAU * nl + C0RW[ti] + n * 0.5, k = fl(w), f = w - k; if (f < 0.22) v -= (k % 7 === 0 ? 0.75 : 0.38) * (1 - glowG * 0.6) * na; else if (f > 0.5 && f < 0.64) v += 0.25 * na; }
        if (spec > 0.955) { v += (spec - 0.955) * 55; if (spec > 0.99 && ih(fl(th * 300), fl(n * 5), 583) > 1 - gl) return 22; }
        if (ph < 0.62) { const rs = 6 * Math.pow(1 - ph / 0.62, 1.4); if (Math.abs(rho - rs) < lw) return 130; if (rho > rs) v -= 0.8; }
        if (fa > 0.02) { const lip = wR - rho; if (lip < 3.8 * fa + 0.3) v = lip < 0.9 * fa + 0.3 ? 2.1 : 3.5 + 0.9 * fa + (lip < 2.2 * fa ? 0.6 : 0); }
        return c0Rp(C0AMB, v, X, Y);
      });
    }

    /* ---------------------------------------------------------------- fireflies */
    const C0FLY = [];
    for (let k = 0; k < 16; k++) {
      const air = k < 5;
      C0FLY.push({ x: air ? [-192, -166, 200, 210, -206][k] : lerp(-208, 208, ih(k, 1, 591)), y: air ? [42, 96, 74, -12, -40][k] : lerp(132, 172, ih(k, 2, 591)),
        ax: 6 + 10 * ih(k, 3, 591), ay: 4 + 6 * ih(k, 4, 591), nx: 1 + fl(ih(k, 5, 591) * 2), ny: 2 + fl(ih(k, 6, 591) * 2), ph: ih(k, 7, 591) * TAU, nb: 3 + fl(ih(k, 8, 591) * 4) });
    }
    // light that keeps its surface's hue: each colour lifted one step up its own ramp (warm, for what has no ramp here)
    const C0LIT = new Uint8Array(256);
    for (let i = 0; i < 256; i++) C0LIT[i] = i < NPAL ? T_WARM[2][i] : i;
    for (const R of [C0GRN, [130, 131, 132, 133, 15, 16, 108, 22], [134, 135, 136, 137, 138, 147, 148, 22], [1, 2, 3, 4, 5, 6, 7, 8, 56, 57, 22], [139, 140, 141, 142, 143, 50, 53], [0, 1], [23, 24, 25, 26, 49], [116, 117, 118, 119, 148], [19, 20, 21, 22], [144, 16, 22], [59, 60, 22], [58, 59], [44, 75, 22]])
      for (let k = 0; k + 1 < R.length; k++) C0LIT[R[k]] = R[k + 1];
    function c0Light(X, Y, r, a) {
      if (a <= 0.01 || r < 0.6) return;
      const x0 = Math.max(0, fl(X - r)), x1 = Math.min(W - 1, Math.ceil(X + r)), y0 = Math.max(c0ROW0, fl(Y - r)), y1 = Math.min(c0ROW1, Math.ceil(Y + r)), ir = 1 / r;
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const dx = (xx + 0.5 - X) * ir, dy = (yy + 0.5 - Y) * ir, d = dx * dx + dy * dy; if (d >= 1) continue;
        const f = a * (1 - Math.sqrt(d)), b = bay(xx, yy), i = yy * W + xx;
        if (b < f * f * 1.6) { BUF[i] = C0LIT[BUF[i]]; if (b < f * f * 0.5) BUF[i] = C0LIT[BUF[i]]; }
      }
    }
    function c0Firefly(V, x, y, b, big) {
      if (b <= 0.03) return;
      const u = V.u, X = V.X(x), Y = V.Y(y);
      if (X < -24 || X > W + 24 || Y < c0ROW0 || Y > c0ROW1) return;
      c0Light(X, Y, Math.max(2.5, (big ? 17 : 8) * u), (big ? 0.95 : 0.6) * b);
      if (!big) { P(X, Y, b > 0.55 ? 60 : b > 0.3 ? 59 : 58); return; }
      // the visitor: a little lamp with a soft cross of light
      const rc = Math.max(0.8, 1.3 * u * (0.8 + 0.2 * b));
      if (u < 0.45) { P(X, Y, 60); return; }
      discF(X, Y, rc + Math.max(0.7, 0.6 * u), 58); discF(X, Y, rc, 59); discF(X - 0.25 * rc, Y - 0.25 * rc, rc * 0.6, 60);
      if (b > 0.35) { const L = Math.round((1.5 + 3 * b) * clamp(u, 0.3, 1.6)); for (let k = 1; k <= L; k++) { const c = k < L * 0.5 ? 59 : 15; P(X + rc + k, Y, c); P(X - rc - k, Y, c); P(X, Y + rc + k, c); P(X, Y - rc - k, c); } }
    }
    function c0Flies(V, t, near) {
      for (let k = 0; k < C0FLY.length; k++) {
        const f = C0FLY[k]; if ((k < 5) !== near) continue;
        const x = f.x + f.ax * Math.sin(zP(t, f.nx) + f.ph), y = f.y + f.ay * Math.sin(zP(t, f.ny) + f.ph * 1.3), b = 0.5 + 0.5 * Math.sin(zP(t, f.nb) + f.ph * 2.1);
        c0Firefly(V, x, y, b * b, false);
      }
      if (near && c0F.Vf) { const [x, y, a] = c0F.Vf; c0Firefly(V, x, y, a * (0.72 + 0.28 * Math.sin(zP(t, 24))), true); }
    }

    /* ---------------------------------------------------------------- the whole layer */
    function c0Draw(V, t) {
      const u = V.u, hx = 240 / u, hy = (135 - LB) / u;
      // magnified so far that the whole frame is inside the shell (the galaxy): nothing of ours shows
      let far = 0;
      for (const [cx, cy] of [[-hx, -hy], [hx, -hy], [-hx, hy], [hx, hy]]) far = Math.max(far, Math.hypot(cx - c0SX, cy - c0SY));
      if (far < 62) return;
      c0Frame(V, t);
      c0Sky(V, t);
      c0Stars(V, t);
      c0Weeds(V, t);
      c0Shoot(V, c0F.M);
      c0Flies(V, t, false);
      for (const P of C0LEAVES) c0Leaf(V, P, t);
      for (const P of C0PETS) if (P.row < 3) c0Petal(V, P, t);
      c0Stamens(V, t);
      c0Snail(V);
      c0Rim(V);
      for (let k = 0; k < C0PETS.length; k++) { const P = C0PETS[k]; if (P.row === 3) { c0Petal(V, P, t); c0Dew(V, P, t, k); } }
      c0Pollen(V, t);
      c0Flies(V, t, true);
    }
    ZL[0] = { name: 'snail', draw: c0Draw, mask: c0Mask, maskBox: [-84, -74, 48, 58] };
  }

  /* ================================================================ Carry · L1 — the meadow at night
     We pull back from the snail and find it on the brow of a meadow hill, under the whole night. Its flower (L0) shows
     through the window at the origin; around it the brow runs almost level (y ≈ 19 by the window, 20 at the frame's edge,
     where the valley takes over) and the meadow falls away toward us in depth: forty-odd bands of grass, each 1.1× nearer
     and bigger than the one behind it, painted front to back through a depth buffer, with harebells, dandelion clocks,
     mushrooms and daisies standing among them, and fireflies at every depth, lighting what is near them. The band at the
     brow is L0's own grass, blade for blade (the same hashes, the same wind), and L0's own fireflies fly here too, so the
     seam under the snail cannot be seen. Above: the night deepening from 135 to 134, a soft glow along the horizon behind a
     line of far trees on the left, a faint aurora top left, the Milky Way rising on the right, and stars at every scale.
     Every motion turns on the 15 s loop (zP). */
  {
    // ---- the screen rect of this draw (the box, less the letterbox) and the depth buffer
    //   depth: 0 the sky, 1 the far trees, 2 the snail's stem, 3 + 5j the meadow's band j (things standing in band j sit
    //   between, at c1Zof(j)); 255 the window, which the inner layer covers
    const c1R0 = LB, c1R1 = H - 1 - LB;
    const c1Z = new Uint8Array(NP);
    let c1X0 = 0, c1X1 = 0, c1Y0 = 0, c1Y1 = 0;
    const c1Pow = (j) => Math.pow(1.1, j);
    const c1Zof = (j) => { const k = fl(j); return Math.min(254, 4 + 5 * k + Math.min(3, fl((j - k) * 4))); };
    const c1Rq = (R, v, X, Y, dw) => { const i = fl(v + 0.5 + (bay(X, Y) - 0.5) * dw); return R[i < 0 ? 0 : i >= R.length ? R.length - 1 : i]; };

    // ---- the ground. Band j's baseline (where its blades rise from) at x. The brow (band 0) is L0's meadow line, a gentle
    //   hill that sinks one unit by the frame's edge; the bands nearer us bunch a little under the window, so nothing of
    //   ours but L0's own grass stands inside its soft edge
    const c1Hill = (x) => { const a = Math.max(0, Math.abs(x) - 40) / 248; return a * a; };
    const c1Top0 = (x) => (153 + 1.7 * Math.sin(x * 0.648 + 1.3) + 1.2 * Math.sin(x * 1.84 + 0.4)) / 8 + c1Hill(x);
    function c1BaseS(j, s, x) {
      const raw = 10 + (9.125 + c1Hill(x)) * s, ax = Math.abs(x), m = j < 1 ? j : 1;
      let y = raw + 0.22 * s * Math.sin(x / s * 0.13 + j * 1.7) * m;
      if (ax < 84) y += 6 * (1 - sstep(36, 84, ax)) * Math.exp(-(raw - 19) / 6) * m;
      return j < 1 ? lerp(c1Top0(x), y, j) : y;
    }
    const c1Base = (j, x) => (j <= 0 ? c1Top0(x) : c1BaseS(j, c1Pow(j), x));

    // ---- small drawing helpers, all behind whatever is nearer (depth z)
    function c1Each(V, x0, y0, x1, y1, z, fn) {
      const u = V.u;
      const X0 = Math.max(c1X0, fl(240 + x0 * u)), X1 = Math.min(c1X1, Math.ceil(240 + x1 * u)), Y0 = Math.max(c1Y0, fl(135 + y0 * u)), Y1 = Math.min(c1Y1, Math.ceil(135 + y1 * u));
      for (let Y = Y0; Y <= Y1; Y++) {
        const y = (Y + 0.5 - 135) / u, o = Y * W;
        for (let X = X0; X <= X1; X++) {
          const i = o + X; if (c1Z[i] > z) continue;
          const c = fn((X + 0.5 - 240) / u, y, X, Y); if (c >= 0) { BUF[i] = c; c1Z[i] = z; }
        }
      }
    }
    function c1Dot(X, Y, r, z, c) {
      if (r < 0.75) { const x = fl(X), y = fl(Y); if (x < c1X0 || x > c1X1 || y < c1Y0 || y > c1Y1) return; const i = y * W + x; if (c1Z[i] <= z) { BUF[i] = c; c1Z[i] = z; } return; }
      const r2 = r * r, x0 = Math.max(c1X0, fl(X - r)), x1 = Math.min(c1X1, Math.ceil(X + r)), y0 = Math.max(c1Y0, fl(Y - r)), y1 = Math.min(c1Y1, Math.ceil(Y + r));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x + 0.5 - X, dy = y + 0.5 - Y; if (dx * dx + dy * dy > r2) continue; const i = y * W + x; if (c1Z[i] <= z) { BUF[i] = c; c1Z[i] = z; } }
    }
    // a tapering stroke along the quadratic curve a → b (control c), radius r0 → r1 units; lit: the colour of its lit
    // (upper left) side when it is thick enough to have one
    function c1Stroke(V, ax, ay, cx, cy, bx, by, r0, r1, z, col, lit) {
      const u = V.u, L = (Math.hypot(cx - ax, cy - ay) + Math.hypot(bx - cx, by - cy)) * u, n = Math.max(2, Math.ceil(L * 1.3));
      if (L < 0.5) { c1Dot(240 + bx * u, 135 + by * u, 0.5, z, col); return; }
      for (let k = 0; k <= n; k++) {
        const q = k / n, a = (1 - q) * (1 - q), b = 2 * q * (1 - q), d = q * q;
        const X = 240 + (a * ax + b * cx + d * bx) * u, Y = 135 + (a * ay + b * cy + d * by) * u, r = Math.max(0.5, lerp(r0, r1, q) * u);
        c1Dot(X, Y, r, z, col);
        if (lit >= 0 && r >= 1.3) c1Dot(X - r * 0.38, Y - r * 0.2, r * 0.5, z, lit);
      }
    }
    // light that keeps its surface's hue: each colour lifted one step up its own ramp (L0's table, so the light agrees)
    const c1LIT = new Uint8Array(256);
    for (let i = 0; i < 256; i++) c1LIT[i] = i < NPAL ? T_WARM[2][i] : i;
    for (const R of [[124, 125, 126, 127, 128, 129], [130, 131, 132, 133, 15, 16, 108, 22], [134, 135, 136, 137, 138, 147, 148, 22], [1, 2, 3, 4, 5, 6, 7, 8, 56, 57, 22], [139, 140, 141, 142, 143, 50, 53], [0, 1], [23, 24, 25, 26, 49], [116, 117, 118, 119, 148], [19, 20, 21, 22], [144, 16, 22], [59, 60, 22], [58, 59], [44, 75, 22]])
      for (let k = 0; k + 1 < R.length; k++) c1LIT[R[k]] = R[k + 1];
    function c1Light(X, Y, r, a) {
      if (a <= 0.01 || r < 0.6) return;
      const x0 = Math.max(c1X0, fl(X - r)), x1 = Math.min(c1X1, Math.ceil(X + r)), y0 = Math.max(c1Y0, fl(Y - r)), y1 = Math.min(c1Y1, Math.ceil(Y + r)), ir = 1 / r;
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const dx = (xx + 0.5 - X) * ir, dy = (yy + 0.5 - Y) * ir, d = dx * dx + dy * dy; if (d >= 1) continue;
        const f = a * (1 - Math.sqrt(d)), b = bay(xx, yy), i = yy * W + xx;
        if (b < f * f * 1.6) { BUF[i] = c1LIT[BUF[i]]; if (b < f * f * 0.5) BUF[i] = c1LIT[BUF[i]]; }
      }
    }

    /* ---------------------------------------------------------------- the grass, band by band */
    const C1NB = 44, C1SP = 0.2875;                                  // bands; blades 0.2875 s apart (L0's, 2.3 of its units)
    // ramps by distance: far off (hazed toward the night), the middle meadow, close to us (in shadow); and a cooler teal
    const C1GF = [134, 139, 23, 24, 25, 137], C1G = [1, 139, 140, 141, 142, 143], C1GN = [0, 1, 139, 140, 141, 142], C1T = [1, 23, 24, 25, 26, 143];
    // how much light a band's grass holds: the far meadow catches the sky, nearer it falls into shadow
    const c1Tone = (j) => 1.45 - 0.25 * sstep(4, 12, j) - 0.45 * sstep(15, 28, j);
    // tufts: a smooth, irregular height for the grass along each band (a periodic table, 128 band units round)
    const C1CL = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const a = i / 1024 * TAU; C1CL[i] = 0.42 + 0.78 * clamp(0.5 + 0.32 * Math.sin(a * 37) + 0.22 * Math.sin(a * 91 + 1.3) + 0.14 * Math.sin(a * 13 + 0.4), 0, 1); }
    const c1YA = new Float32Array(W), c1YB = new Float32Array(W), c1SWA = new Float32Array(W / 4 + 8);
    // band j (j ≥ 1) at depth scale s: yb its baseline per column, yn the band in front's (where our ground may stop)
    function c1Band(V, t, j, s, yb, yn) {
      const u = V.u, su = s * u, z = 3 + 5 * j, sl = sstep(5, 22, j), hm = 1 + 0.55 * sl, w0 = 0.085 + 0.05 * (1 - sl), mws = 0.5 / su;
      const tone = c1Tone(j), R0 = j < 6 ? C1GF : j < 18 ? C1G : C1GN, X0 = c1X0, X1 = c1X1, Y0 = c1Y0, Y1 = c1Y1;
      // the ground under the blades, in their shadow, streaked
      for (let X = X0; X <= X1; X++) {
        const b0 = yb[X], Ya = Math.max(Y0, Math.ceil(135 + b0 * u - 0.5)), Yb = yn ? Math.min(Y1, Math.ceil(135 + yn[X] * u) + 1) : Y1;
        if (Ya > Yb) continue;
        const st = (ih(fl((X + 0.5 - 240) / su * 4.7), j, 561) - 0.5) * 1.2 + tone - 0.7;
        for (let Y = Ya; Y <= Yb; Y++) { const i = Y * W + X; if (c1Z[i] >= z) continue; BUF[i] = c1Rq(R0, st - ((Y + 0.5 - 135) / u - b0) / s * 0.9, X, Y, 0.7); c1Z[i] = z; }
      }
      if (C1SP * su < 0.45) {                                          // too small for single blades: a ragged top
        for (let X = X0; X <= X1; X++) {
          const b0 = yb[X], xw = (X + 0.5 - 240) / su, hr = ih(fl(xw / C1SP), j, 1207);
          let top = b0 - s * (0.3 + 1.3 * hr * hr) * hm * C1CL[(fl(xw * 8) + j * 137) & 1023];
          if (xw * s > -46 && xw * s < 46) top = Math.max(top, Math.min(b0, 22.6));
          const Ya = Math.max(Y0, Math.ceil(135 + top * u - 0.5)), Yb = Math.min(Y1, Math.ceil(135 + b0 * u - 0.5) - 1);
          for (let Y = Ya; Y <= Yb; Y++) { const i = Y * W + X; if (c1Z[i] >= z) continue; BUF[i] = c1Rq(R0, tone + 0.6 + (bay(X + 3, Y + 1) - 0.5), X, Y, 0.6); c1Z[i] = z; }
        }
        return;
      }
      // the wind along the band (at the brow it is L0's), every 4 columns
      const p2 = zP(t, 2) + 0.35 * j, p3 = zP(t, 3) + 0.2 * j;
      for (let q = 0, X = X0; X <= X1 + 4; X += 4, q++) { const xw = (X + 2 - 240) / su; c1SWA[q] = 0.10 * Math.sin(p2 + 0.232 * xw) + 0.05 * Math.sin(p3 - 0.56 * xw); }
      const wide = w0 * su > 1.0, lean = 0.75 * (1 + 1.8 * sl), glowL = j < 16 ? 0.35 : 0.15, mg = (lean * 0.5 + 1) * su + 4, mk = Math.ceil(mg / (C1SP * su)) + 2;
      const k0 = fl(V.lx(X0) / s / C1SP) - mk, k1 = fl(V.lx(X1) / s / C1SP) + mk;
      for (let k = k0; k <= k1; k++) {
        const r1 = ih(k, j, 1201), r2 = ih(k, j, 1202), bx = (k + 0.5 + (r2 - 0.5) * 0.8) * C1SP, Xf = 240 + bx * su;
        if (Xf < X0 - mg || Xf > X1 + mg) continue;
        const xi = Xf < X0 ? X0 : Xf > X1 ? X1 : fl(Xf), b0 = yb[xi];
        let hb = (2.5 + r1 * r1 * 15 + (r1 > 0.94 ? 13 : 0)) / 8 * hm * C1CL[(fl(bx * 8) + j * 137) & 1023];
        const xu = bx * s; if (xu > -46 && xu < 46) hb = Math.min(hb, Math.max(0.12, (b0 - 22.6) / s));   // none of ours inside the window's edge
        const Yt = Math.max(Y0, Math.ceil(135 + (b0 - hb * s) * u - 0.5)), Ye = Math.min(Y1, fl(135 + b0 * u - 0.5));
        if (Yt > Ye) continue;
        const r3 = frac(r1 * 9.73 + r2 * 3.11), L = (r3 - 0.5) * lean, ms = c1SWA[(xi - X0) >> 2], R = r2 > 0.7 ? C1T : R0;
        const cv = (frac(r2 * 17.3 + r1 * 5.7) - 0.5) * 0.9 + tone + glowL * sstep(-40, -210, xu);
        for (let Y = Yt; Y <= Ye; Y++) {
          const hg = (b0 - (Y + 0.5 - 135) / u) / s, f = hg / hb, cx = bx + L * f * f + ms * hg, hw = Math.max(w0 * (1 - f) + 0.02, mws);
          let Xa = Math.ceil(240 + (cx - hw) * su - 0.5), Xe = fl(240 + (cx + hw) * su - 0.5);
          if (Xa > Xe) Xa = Xe = fl(240 + cx * su);
          if (Xa < X0) Xa = X0; if (Xe > X1) Xe = X1;
          const o = Y * W, v0 = cv + 1.5 * f * f;
          for (let X = Xa; X <= Xe; X++) {
            const i = o + X; if (c1Z[i] >= z) continue;
            let v = v0;
            if (wide) { const sd = ((X + 0.5 - 240) / su - cx) / hw; v -= 0.55 * sd; if (sd < -0.5 && f > 0.2) v += 0.9; }
            BUF[i] = c1Rq(R, v, X, Y, 0.6); c1Z[i] = z;
          }
        }
      }
    }
    // band 0: L0's own meadow (its blades, its wind, its shadows), in its units — so where the window's edge mixes the two
    // layers, both show the same grass
    const C1N0 = 4200, c1H0 = new Float32Array(C1N0), c1XB0 = new Float32Array(C1N0), c1L0 = new Float32Array(C1N0), c1C0 = new Uint8Array(C1N0), c1T0 = new Uint8Array(C1N0);
    function c1Band0(V, t, yn) {
      const u = V.u, u0 = u / 8, mw = 0.55 / u0, z = 3;
      const xa = V.lx(c1X0) * 8, xb = V.lx(c1X1) * 8, j0 = fl(xa / 2.3) - 4, n = fl(xb / 2.3) + 4 - j0 + 1, blades = n <= C1N0;
      if (blades) for (let i = 0; i < n; i++) {
        const jj = j0 + i, r1 = ih(jj, 1, 563), r2 = ih(jj, 2, 563), r3 = ih(jj, 3, 563);
        c1H0[i] = 2.5 + r1 * r1 * 15 + (r1 > 0.94 ? 15 : 0); c1XB0[i] = (jj + 0.5 + (r2 - 0.5) * 0.8) * 2.3; c1L0[i] = (r3 - 0.5) * 6;
        c1C0[i] = r2 < 0.45 ? 140 : 139; c1T0[i] = r3 > 0.72 && u0 > 0.3 ? 1 : 0;
      }
      const p2 = zP(t, 2), p3 = zP(t, 3);
      for (let X = c1X0; X <= c1X1; X++) {
        const x = (X + 0.5 - 240) / u, x0 = x * 8;
        const MF = 153 + 1.7 * Math.sin(x0 * 0.081 + 1.3) + 1.2 * Math.sin(x0 * 0.23 + 0.4) + 8 * c1Hill(x);
        const MS = 0.10 * Math.sin(p2 + x0 * 0.029) + 0.05 * Math.sin(p3 - x0 * 0.07), sx = 3 * Math.sin(x0 * 0.7);
        const Ya = Math.max(c1Y0, fl(135 + (MF - 34) / 8 * u)), Yb = Math.min(c1Y1, Math.ceil(135 + yn[X] * u) + 1);
        for (let Y = Ya; Y <= Yb; Y++) {
          const i = Y * W + X; if (c1Z[i] >= z) continue;
          const y0 = (Y + 0.5 - 135) / u * 8, hg = MF - y0;
          if (hg > 34) continue;
          let c = -1;
          if (hg <= 0) {
            const k = ih(fl(x0 / 1.7), fl((y0 + sx) / 4.5), 561), v = 1.55 + hg / 30 + (k - 0.5) * 1.3;
            c = v > 1.8 ? 140 : v > 0.5 ? 139 : 23;
          } else if (blades) {
            const xs = x0 - MS * hg, k = fl(xs / 2.3) - j0;
            for (let q = Math.max(0, k - 2), e = Math.min(n - 1, k + 2); q <= e; q++) {
              const hb = c1H0[q]; if (hg >= hb) continue;
              const f = hg / hb, bx = c1XB0[q] + c1L0[q] * f * f, wb = Math.max(1.2 * (1 - f) + 0.2, mw);
              if (Math.abs(xs - bx) < wb) { c = f > 0.66 && c1T0[q] ? 141 : c1C0[q]; break; }
            }
          } else if (hg < 2.5 + 15 * Math.pow(ih(X, 7, 1209), 2)) c = 139;
          if (c >= 0) { BUF[i] = c; c1Z[i] = z; }
        }
      }
    }
    function c1Meadow(V, t) {
      const u = V.u, ybot = V.ly(c1Y1) + 1;
      // the nearest band in view: its tallest blades reach up to about 10 + 3.2 s
      const jm = clamp(Math.ceil(Math.log(Math.max(1.01, (ybot - 10) / 3.2)) / Math.log(1.1)) + 1, 1, C1NB);
      let A = c1YA, B = c1YB;
      for (let j = jm; j >= 1; j--) {
        const s = c1Pow(j);
        for (let X = c1X0; X <= c1X1; X++) A[X] = c1BaseS(j, s, (X + 0.5 - 240) / u);
        c1Band(V, t, j, s, A, j === jm ? null : B);
        const T = A; A = B; B = T;
      }
      c1Band0(V, t, B);
      // the snail's flower stem (L0's), between the blades at the window's foot
      const u0 = u / 8, sh = Math.max(0.5 / u0, 3.5) / 8;
      c1Each(V, 3 - sh, 11, 3 + sh, 52.5, 2, (x, y) => { const q = (x - 3) / sh, dk = y > 19.5 ? 1 : 0; return q < -0.68 ? 140 : q < -0.2 ? 143 - dk : q < 0.36 ? 142 - dk : q < 0.7 ? 141 - dk : 140; });
    }

    /* ---------------------------------------------------------------- the flowers of the meadow */
    const C1BEL = [3, 4, 5, 6, 7, 8, 56, 57];                        // harebell blue-violet, shadow to the pale rim
    // a bell hanging from (ax, ay) along the angle ang (π/2: straight down), Lb units long
    function c1Bell(V, ax, ay, ang, Lb, z) {
      const u = V.u, ca = Math.cos(ang), sa = Math.sin(ang), Lp = Lb * u;
      if (Lp < 1.8) { c1Dot(V.X(ax + ca * Lb * 0.55), V.Y(ay + sa * Lb * 0.55), Math.max(0.5, Lp * 0.4), z, Lp < 1 ? 6 : 7); return; }
      const ex = ax + ca * Lb, ey = ay + sa * Lb, R = Lb * 0.56, ol = 0.85 / u;
      c1Each(V, Math.min(ax, ex) - R, Math.min(ay, ey) - R, Math.max(ax, ex) + R, Math.max(ay, ey) + R, z, (x, y, X, Y) => {
        const dx = x - ax, dy = y - ay, a = dx * ca + dy * sa, c = -dx * sa + dy * ca, q = a / Lb;
        if (q < -0.02 || q > 1.04) return -1;
        const qq = Math.max(0, q), fl7 = Math.max(0, q - 0.68), r = Lb * (0.12 + 0.27 * Math.pow(qq, 0.8) + 0.9 * fl7 * fl7);
        const ac = Math.abs(c); if (ac > r) return -1;
        const qe = 1 - 0.075 * (0.5 + 0.5 * Math.cos(c / (Lb * 0.42) * 7.2));   // the lip's five points, seen from the side
        if (q > qe) return -1;
        if (q < 0.1) return c > 0 ? 141 : 140;                           // the calyx
        const side = c / r;                                              // +1 the side toward the upper left (the light)
        let v = 2.3 + 1.25 * side + 0.9 * (1 - q) + 0.5 * Math.sin(c / Lb * 19) * (Lp > 6 ? 1 : 0);   // and faint ribs
        if (q > qe - 0.11) v = side > -0.2 ? 6.2 : 4.6;                  // the pale rim of the mouth
        else if (r - ac < ol) v -= 1.4;                                  // a crisp dark edge
        return c1Rq(C1BEL, v, X, Y, 0.55);
      });
    }
    function c1Harebell(V, t, P) {
      const s = c1Pow(P.j), z = c1Zof(P.j), bx = P.x, by = c1Base(P.j, P.x) + 0.3 * s, Hh = P.h * s, d = P.dir;
      const sw = (0.07 * Math.sin(zP(t, 2) + P.ph) + 0.035 * Math.sin(zP(t, 3) + P.ph * 1.7)) * Hh;
      const p1x = bx + d * 0.06 * Hh + sw * 0.5, p1y = by - 1.08 * Hh, p2x = bx + d * 0.4 * Hh + sw, p2y = by - 0.9 * Hh;
      if (!V.vis(Math.min(bx, p2x) - Hh * 0.3, by - Hh * 1.1, Math.max(bx, p2x) + Hh * 0.3, by)) return;
      const w = 0.045 * s * (P.th || 1);
      c1Stroke(V, bx, by, p1x, p1y, p2x, p2y, w, w * 0.6, z, P.sil ? 139 : 140, P.sil ? 140 : 141);
      const Lb = P.bs * s, ga = 0.12 * Math.sin(zP(t, 2) + P.ph + 0.6);
      c1Bell(V, p2x, p2y, PI / 2 + d * 0.32 + ga, Lb, z);
      for (let k = 1; k < P.nb; k++) {                                  // the side bells on their short stalks
        const q = 0.78 - k * 0.2, a = (1 - q) * (1 - q), b = 2 * q * (1 - q), e = q * q;
        const sx = a * bx + b * p1x + e * p2x, sy = a * by + b * p1y + e * p2y, o = (k % 2 ? -1 : 1) * d;
        const tx = sx + o * 0.16 * Hh + sw * 0.2, ty = sy - 0.03 * Hh;
        c1Stroke(V, sx, sy, sx + o * 0.1 * Hh, sy - 0.07 * Hh, tx, ty, w * 0.6, w * 0.5, z, 140, -1);
        c1Bell(V, tx, ty, PI / 2 + o * 0.42 + ga * 1.3, Lb * (0.86 - 0.08 * k), z);
      }
    }
    // a dandelion clock: a pale sphere of seeds on a hollow stalk, the light from the horizon behind it
    function c1Clock(V, t, P) {
      const u = V.u, s = c1Pow(P.j), z = c1Zof(P.j), bx = P.x, by = c1Base(P.j, P.x) + 0.3 * s, Hh = P.h * s;
      const sw = (0.04 * Math.sin(zP(t, 2) + P.ph) + 0.02 * Math.sin(zP(t, 3) + P.ph)) * Hh;
      const cx = bx + P.bow * Hh + sw, cy = by - Hh, R = P.R * s, Rp = R * u;
      P.cx = cx; P.cy = cy; P.s = s;
      if (!V.vis(cx - R * 1.2, cy - R * 1.2, Math.max(cx, bx) + R * 1.2, by)) return;
      c1Stroke(V, bx, by, bx + P.bow * 0.3 * Hh, cy + 0.55 * Hh, cx, cy + R * 0.2, 0.05 * s, 0.035 * s, z, 140, 142);
      if (Rp < 2.2) { c1Dot(V.X(cx), V.Y(cy), Math.max(0.5, Rp), z, Rp < 1 ? 19 : 20); return; }
      const nS = clamp(Math.round(TAU * Rp / 2.3), 10, 80), id = P.id, gp = P.gap || 0.08;
      c1Each(V, cx - R * 1.08, cy - R * 1.08, cx + R * 1.08, cy + R * 1.08, z, (x, y, X, Y) => {
        const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy) / R;
        if (d > 1.07) return -1;
        if (d < 0.13) return d < 0.08 ? 17 : 18;                         // the bare seat at the heart
        const th = Math.atan2(dy, dx), a = (th / TAU + 0.5) * nS, si = fl(a), fa = a - si - 0.5;
        if (ih(si, id, 1501) < gp && d > 0.3) return d < 0.5 && Math.abs(fa) * TAU / nS * d * Rp < 0.5 ? 138 : -1;   // a seed already flown
        const lit = -dx / R * 0.62 - dy / R * 0.45;                       // backlit from the left, a little from above
        if (d > 0.7) {                                                   // the tufts round the rim, fuzzy and bright
          const den = (1 - Math.abs(d - 0.89) / 0.18) * (0.78 + 0.22 * ih(fl(x * 7 * u), fl(y * 7 * u), id));
          if (bay(X, Y) > den * 0.95) return Math.abs(fa) * TAU / nS * d * Rp < 0.45 ? 19 : -1;
          return lit > 0.3 ? 21 : lit > -0.25 ? 20 : 19;
        }
        if (Math.abs(fa) * TAU / nS * d * Rp < 0.5) return lit > 0.2 ? 20 : 19;   // the spokes, the seeds' long beaks
        return bay(X + 2, Y + 5) < 0.2 * (1 - d) + 0.06 ? (lit > 0 ? 20 : 19) : 138;   // the tufts that face us, and the haze
      });
    }
    // a mushroom: a brown cap lit from above, gills, a pale stem
    const C1CAP = [27, 28, 29, 30, 31, 66], C1STE = [68, 67, 66, 65];
    function c1Mush(V, t, P) {
      const u = V.u, s = c1Pow(P.j), z = c1Zof(P.j), bx = P.x, by = c1Base(P.j, P.x) + 0.25 * s, Hh = P.h * s, r = P.r * s;
      const cx = bx + P.tilt * Hh, cy = by - Hh, ol = 0.8 / u;
      if (r * u < 1.2) { c1Dot(V.X(cx), V.Y(cy), Math.max(0.5, r * u * 0.7), z, 30); return; }
      c1Each(V, cx - r * 1.05, cy - r * 0.64, Math.max(cx, bx) + r * 1.05, by, z, (x, y, X, Y) => {
        const dx = x - cx, dy = y - cy;
        if (dy <= 0.05 * r) {                                            // the cap
          const nx = dx / r, ny = dy / (0.6 * r), e = nx * nx + ny * ny; if (e > 1) return -1;
          const sp = ih(fl((dx / r + 2) * 4.2), fl((dy / r + 2) * 5), P.id);
          let v = 2.0 - 1.4 * nx * 0.6 - 1.6 * ny * 0.8 + (sp > 0.86 && e < 0.7 ? 2.0 : 0);
          if (e > 1 - 1.7 * ol / r) v -= 1.3;
          return c1Rq(C1CAP, v, X, Y, 0.6);
        }
        if (dy < 0.2 * r) {                                              // the gills, the cap's underside
          if (Math.abs(dx) > r * (0.98 - (dy / r - 0.05) * 2.2)) return -1;
          return frac(dx / r * 7 + 20) < 0.45 ? 68 : 69;
        }
        const q = (dy - 0.05 * r) / (Hh - 0.05 * r), sx = cx + (bx - cx) * q, hw = r * 0.2 * (1 + 0.35 * q);   // the stem
        const ds = (x - sx) / hw; if (ds > 1 || ds < -1 || q > 1) return -1;
        return c1Rq(C1STE, 1.6 - 1.2 * ds - 0.6 * q, X, Y, 0.6);
      });
    }
    // a grass stem gone to seed, standing up against the sky: spikelets hanging off its top
    function c1Panicle(V, t, P) {
      const u = V.u, s = c1Pow(P.j), z = c1Zof(P.j), bx = P.x, by = c1Base(P.j, P.x) + 0.3 * s, Hh = P.h * s, d = P.dir;
      const sw = (0.08 * Math.sin(zP(t, 2) + P.ph) + 0.04 * Math.sin(zP(t, 3) + P.ph * 1.3)) * Hh;
      const tx = bx + d * 0.2 * Hh + sw, ty = by - Hh, cx = bx + d * 0.02 * Hh + sw * 0.3, cy = by - 0.62 * Hh;
      if (!V.vis(Math.min(bx, tx) - 2 * s, ty - s, Math.max(bx, tx) + 2 * s, by)) return;
      c1Stroke(V, bx, by, cx, cy, tx, ty, 0.04 * s, 0.022 * s, z, 1, -1);
      const n = P.n;
      for (let k = 0; k < n; k++) {
        const q = 0.55 + 0.45 * k / (n - 1), a = (1 - q) * (1 - q), b = 2 * q * (1 - q), e = q * q;
        const px = a * bx + b * cx + e * tx, py = a * by + b * cy + e * ty, sd = k % 2 ? 1 : -1, L = (0.62 - 0.36 * (q - 0.55) / 0.45) * s * P.sz;
        const ex = px + (sd * 0.55 + d * 0.55) * L + sw * 0.12, ey = py + 0.6 * L;
        c1Stroke(V, px, py, (px + ex) / 2, py + 0.08 * L, ex, ey, 0.018 * s, 0.018 * s, z, 1, -1);
        const gx = ex + (sd * 0.2 + d * 0.3) * L * 0.5, gy = ey + 0.42 * L;
        c1Stroke(V, ex, ey, ex, ey, gx, gy, 0.075 * s * P.sz, 0.05 * s * P.sz, z, k % 3 ? 139 : 140, 141);
      }
    }
    // the meadow's small white flowers, far and near
    function c1Daisy(V, P) {
      const u = V.u, s = c1Pow(P.j), z = c1Zof(P.j), x = P.x, y = c1Base(P.j, P.x) - P.h * s, rp = 0.24 * s * u * P.sz;
      const X = V.X(x), Y = V.Y(y);
      if (X < c1X0 - 4 || X > c1X1 + 4 || Y < c1Y0 - 4 || Y > c1Y1 + 4) return;
      if (rp < 0.7) { c1Dot(X, Y, 0.5, z, P.c ? 20 : 19); return; }
      if (rp < 1.7) { c1Dot(X, Y, 0.5, z, 15); for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c1Dot(X + ox, Y + oy, 0.5, z, oy < 0 || ox < 0 ? 21 : 20); return; }
      const r = 0.24 * s * P.sz, sk = P.c ? 0.55 : 0.35;                // seen a little from above: squashed
      c1Each(V, x - r, y - r * sk, x + r, y + r * sk, z, (xx, yy, XX, YY) => {
        const dx = (xx - x) / r, dy = (yy - y) / (r * sk), d = Math.sqrt(dx * dx + dy * dy); if (d > 1) return -1;
        if (d < 0.32) return d < 0.18 ? 14 : 15;
        if (frac(Math.atan2(dy, dx) / TAU * 11 + 0.25) < 0.22) return -1;
        return dy < 0.1 ? 21 : 20;
      });
    }

    // ---- what stands in the meadow (x at nominal size; j its depth band; h its height in band units)
    const C1PROPS = [];
    const c1Add = (type, o) => C1PROPS.push(Object.assign({ type, ph: C1PROPS.length * 1.37 }, o));
    // on the brow, against the sky beside the window: what the zoom shows first
    c1Add('clock', { x: -43.6, j: 0.25, h: 7.6, R: 1.85, bow: -0.04, id: 1, gap: 0.12 });
    c1Add('pan', { x: -38.9, j: 0.3, h: 9.6, dir: -1, n: 9, sz: 1 });
    c1Add('pan', { x: -50.5, j: 0.35, h: 6.4, dir: 1, n: 7, sz: 0.85 });
    c1Add('pan', { x: -58.2, j: 0.2, h: 8.4, dir: -1, n: 8, sz: 0.9 });
    c1Add('bell', { x: -66, j: 0.3, h: 5.6, dir: -1, nb: 2, bs: 0.95 });
    c1Add('bell', { x: 41.4, j: 0.3, h: 6.6, dir: 1, nb: 3, bs: 1.0 });
    c1Add('pan', { x: 38.3, j: 0.25, h: 8.9, dir: 1, n: 8, sz: 0.95 });
    c1Add('pan', { x: 49.5, j: 0.35, h: 10.6, dir: 1, n: 10, sz: 1 });
    c1Add('clock', { x: 56.5, j: 0.3, h: 5.4, R: 1.3, bow: 0.05, id: 2, gap: 0.05 });
    c1Add('pan', { x: 64, j: 0.2, h: 7.4, dir: -1, n: 8, sz: 0.9 });
    c1Add('bell', { x: 72.5, j: 0.35, h: 4.8, dir: 1, nb: 2, bs: 0.9 });
    for (const [x, h, d] of [[-76, 6.2, 1], [-91, 8.6, -1], [-107, 5.8, 1], [-141, 7.6, -1], [-163, 6, 1], [-189, 8.1, -1], [-217, 6.5, 1], [-247, 7.2, -1], [-274, 5.6, 1],
      [86, 8.2, 1], [101, 6.1, -1], [121, 9.1, 1], [146, 6.6, -1], [172, 8.4, 1], [199, 6.2, -1], [231, 7.8, 1], [262, 6.4, -1]])
      c1Add('pan', { x, j: 0.2 + ih(x | 0, 1, 1601) * 0.4, h, dir: d, n: 7 + fl(ih(x | 0, 2, 1601) * 4), sz: 0.8 + 0.25 * ih(x | 0, 3, 1601) });
    for (const [x, h] of [[-122, 4.6], [-178, 5.2], [-232, 4.4], [112, 5], [158, 4.4], [214, 5.4], [248, 4.6]])
      c1Add('bell', { x, j: 0.4, h, dir: x < 0 ? -1 : 1, nb: 1 + fl(ih(x | 0, 4, 1601) * 3), bs: 0.9 });
    // the middle distance
    for (const [x, j, h, d, nb] of [[-71, 6.6, 4.6, -1, 3], [-80, 8.4, 5.4, 1, 2], [-93, 7.4, 4.2, -1, 3], [-113, 10, 5, 1, 2], [-129, 9, 4.2, -1, 1],
      [63, 5.8, 4.8, 1, 3], [79, 7.8, 4.4, -1, 2], [92, 6.4, 3.8, 1, 1], [-232, 11, 4.8, 1, 3], [238, 9.5, 4.6, -1, 2], [-262, 7, 4, 1, 2]])
      c1Add('bell', { x, j, h, dir: d, nb, bs: 0.95 });
    c1Add('clock', { x: 99, j: 9.6, h: 5.6, R: 1.5, bow: 0.06, id: 3, gap: 0.08 });
    c1Add('clock', { x: -139, j: 12.6, h: 4.9, R: 1.6, bow: -0.05, id: 4, gap: 0.1 });
    c1Add('clock', { x: 152, j: 13.2, h: 4.4, R: 1.4, bow: 0.04, id: 5, gap: 0.3 });
    c1Add('mush', { x: 126, j: 11, h: 1.25, r: 1.05, tilt: -0.08, id: 6 });
    c1Add('mush', { x: 131.8, j: 11.5, h: 0.78, r: 0.64, tilt: 0.12, id: 7 });
    c1Add('mush', { x: -57, j: 14.4, h: 0.95, r: 0.82, tilt: 0.06, id: 8 });
    // near us
    c1Add('clock', { x: -172, j: 19, h: 7.2, R: 2.35, bow: -0.05, id: 9, gap: 0.1 });
    c1Add('clock', { x: -214, j: 17.3, h: 5.6, R: 1.75, bow: 0.06, id: 10, gap: 0.42 });
    c1Add('bell', { x: 176, j: 21, h: 5.0, dir: -1, nb: 3, bs: 1.05, th: 1.2 });
    c1Add('bell', { x: 212, j: 22.6, h: 4.3, dir: 1, nb: 2, bs: 1.0, th: 1.2 });
    c1Add('bell', { x: 151, j: 23.6, h: 3.2, dir: 1, nb: 2, bs: 0.95, th: 1.2 });
    c1Add('mush', { x: -98, j: 20.2, h: 1.4, r: 1.15, tilt: -0.05, id: 11 });
    c1Add('mush', { x: -91.5, j: 20.5, h: 0.8, r: 0.66, tilt: 0.14, id: 12 });
    // daisies everywhere (never in front of the window)
    for (let k = 0, m = 0; k < 160 && m < 90; k++) {
      const j = 1 + ih(k, 1, 1611) * 17, x = (ih(k, 2, 1611) - 0.5) * 600;
      if (Math.abs(x) < 52 && c1Base(j, x) < 34) continue;
      c1Add('daisy', { x, j, h: 0.35 + 0.6 * ih(k, 3, 1611), sz: 0.8 + 0.4 * ih(k, 4, 1611), c: ih(k, 5, 1611) < 0.6 ? 1 : 0 }); m++;
    }
    C1PROPS.sort((a, b) => b.j - a.j);
    const C1CLOCKS = C1PROPS.filter((P) => P.type === 'clock');
    // dandelion seeds drifting off the clocks, up into the night: [clock id, turns per loop, phase, drift x, drift y]
    const C1SEEDS = [[9, 1, 0.1, 9, -7], [9, 1, 0.45, 12, -5], [9, 2, 0.7, 7, -9], [9, 1, 0.8, 14, -3], [10, 1, 0.3, 10, -6], [3, 1, 0.6, 8, -6], [1, 1, 0.2, -7, -5], [4, 1, 0.9, 9, -6]];
    function c1Props(V, t) {
      for (const P of C1PROPS) {
        if (P.type === 'daisy') c1Daisy(V, P);
        else if (P.type === 'bell') c1Harebell(V, t, P);
        else if (P.type === 'clock') c1Clock(V, t, P);
        else if (P.type === 'mush') c1Mush(V, t, P);
        else c1Panicle(V, t, P);
      }
    }
    function c1Seeds(V, t) {
      const u = V.u;
      for (const [id, n, ph, dx, dy] of C1SEEDS) {
        const C = C1CLOCKS.find((P) => P.id === id); if (!C || C.cx === undefined) continue;
        const p = frac(t * n / 15 + ph), s = C.s, a = sstep(0, 0.12, p) * (1 - sstep(0.7, 1, p));
        if (a < 0.05) continue;
        const x = C.cx + C.R * s * 0.8 + dx * s * p + 0.6 * s * Math.sin(zP(t, 3 * n) + ph * 9), y = C.cy - C.R * s * 0.4 + dy * s * p + 0.4 * s * Math.sin(zP(t, 2 * n) + ph * 5);
        const X = V.X(x), Y = V.Y(y), r = 0.32 * s * u, z = c1Zof(C.j);
        if (r < 1.2) { c1Dot(X, Y, 0.5, z, a > 0.5 ? 20 : 19); continue; }
        c1Dot(X, Y + r * 0.6, 0.5, z, 19);
        for (let k = -2; k <= 2; k++) { const an = -PI / 2 + k * 0.42; c1Dot(X + Math.cos(an) * r * 0.7, Y + Math.sin(an) * r * 0.7, 0.5, z, k === 0 ? 21 : 20); }
      }
    }

    /* ---------------------------------------------------------------- the far trees on the left horizon */
    // [x, trunk width, crowns [x, y, r] ...], standing behind the brow
    const C1TREES = [
      [-84.5, 0.55, [[-84.5, 13.4, 2.7], [-82.6, 14.7, 2.1], [-86.6, 14.9, 1.9]]],
      [-97.5, 0.4, [[-97.5, 16.1, 1.7], [-96.2, 16.8, 1.4]]],
      [-126, 0.7, [[-126, 12.6, 3.2], [-122.8, 14.1, 2.7], [-129.4, 14.3, 2.6], [-125.6, 10.7, 1.6]]],
      [-149, 0.5, [[-149, 14.6, 2.2], [-146.4, 15.6, 1.8]]],
      [-160.5, 0.6, [[-160.5, 13.2, 2.6], [-163.4, 14.6, 2.2], [-158, 15.2, 2]]],
      [-176, 0.5, [[-176, 15.3, 2], [-178.5, 16.4, 1.6]]],
      [-205, 0.5, [[-205, 11.6, 1.4], [-205.2, 13.4, 1.9], [-204.8, 15.6, 2.2]]],
      [-229, 0.45, [[-229, 15.6, 1.9], [-226.8, 16.6, 1.5]]],
    ];
    for (const T of C1TREES) { let x0 = 1e9, x1 = -1e9, y0 = 1e9; for (const [x, y, r] of T[2]) { x0 = Math.min(x0, x - r * 1.2); x1 = Math.max(x1, x + r * 1.2); y0 = Math.min(y0, y - r * 1.2); } T.push([x0, y0, x1]); }
    function c1Trees(V) {
      const u = V.u; if (u < 0.04) return;
      const fine = u > 1.6, ol = 0.9 / u;
      // a low hedge of bushes along the horizon between them
      c1Each(V, -236, 16.4, -79, 21.5, 1, (x, y, X, Y) => {
        const top = 18.2 - 1.3 * vn(x, 0, 2.4, 1621) - 0.7 * vn(x, 0, 0.8, 1622) + 1.6 * sstep(-90, -79, x) + 1.6 * sstep(-226, -236, x);
        if (y < top) return -1;
        return y < top + ol && bay(X, Y) < 0.6 ? 135 : 134;
      });
      for (const T of C1TREES) {
        const [tx, tw, cr, bb] = T;
        if (!V.vis(bb[0], bb[1], bb[2], 21)) continue;
        c1Each(V, bb[0], bb[1], bb[2], 21, 1, (x, y, X, Y) => {
          const n = vn(x, y, 1.1, 1631) * (fine ? 0.6 : 1) + (fine ? vn(x, y, 0.38, 1632) * 0.4 : 0);
          let best = 9;
          for (const [cx, cy, r] of cr) { const d = Math.hypot(x - cx, y - cy) / (r * (0.84 + 0.32 * n)); if (d < best) best = d; }
          if (best < 1) { const rm = (1 - best) * cr[0][2]; return rm < ol ? (bay(X, Y) < 0.55 ? 135 : 134) : rm < ol * 2.2 && y < cr[0][1] && x < tx && bay(X, Y) < 0.25 ? 135 : 134; }
          if (Math.abs(x - tx) < tw * 0.5 && y > cr[0][1]) return 134;
          return -1;
        });
      }
    }

    /* ---------------------------------------------------------------- the sky */
    // the Milky Way: a static map (2 units a cell) of its light and its hue, rising from the right horizon
    const C1MX0 = -60, C1MY0 = -240, C1MC = 2, C1MW = 190, C1MH = 132;
    const C1MWI = new Float32Array(C1MW * C1MH), C1MWH = new Uint8Array(C1MW * C1MH);
    {
      const ax = 226, ay = 14, bx = 30, by = -224, L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
      for (let jy = 0; jy < C1MH; jy++) for (let ix = 0; ix < C1MW; ix++) {
        const x = C1MX0 + ix * C1MC, y = C1MY0 + jy * C1MC, al = (x - ax) * ux + (y - ay) * uy, pp = -(x - ax) * uy + (y - ay) * ux;
        const wid = 21 + 9 * (vn(al, 0, 46, 1641) - 0.5);
        let I = Math.exp(-(pp / wid) * (pp / wid)) * (0.38 + 0.8 * fbm(x, y, 18, 3, 1651));
        const rc = 2 + 10 * (vn(al, 3, 34, 1661) - 0.5), rw = 3.2 + 2.6 * vn(al, 9, 22, 1671);
        I *= 1 - 0.8 * Math.exp(-((pp - rc) / rw) * ((pp - rc) / rw)) * sstep(12, 50, al);   // the dark rift of dust
        I *= sstep(-6, 34, al) * (1 - sstep(214, 248, x)) * sstep(14, -8, y) * (1 - sstep(-128, -176, y));
        C1MWI[jy * C1MW + ix] = clamp(I, 0, 1);
        C1MWH[jy * C1MW + ix] = fbm(x, y, 30, 2, 1681) > 0.56 ? 1 : 0;
      }
    }
    function c1MW(x, y) {
      const fx = (x - C1MX0) / C1MC, fy = (y - C1MY0) / C1MC;
      if (fx < 0 || fy < 0 || fx >= C1MW - 1 || fy >= C1MH - 1) return 0;
      const i = fl(fx), j = fl(fy), a = fx - i, b = fy - j, o = j * C1MW + i;
      return lerp(lerp(C1MWI[o], C1MWI[o + 1], a), lerp(C1MWI[o + C1MW], C1MWI[o + C1MW + 1], a), b);
    }
    const C1MWR = [-1, 136, 137, 138], C1MWV = [-1, 4, 5, 6];
    const C1AE = new Float32Array(W), C1AQ = new Float32Array(W), C1GX = new Float32Array(W);
    const C1AUG = [-1, 116, 124, 125, 48, 49], C1AUC = [-1, 116, 117, 137, 61, 147];   // (-1: the sky behind)
    function c1Sky(V, t) {
      const u = V.u;
      for (let X = c1X0; X <= c1X1; X++) {
        const x = (X + 0.5 - 240) / u;
        // the soft glow along the horizon: strongest far left (toward the sun, long set), faint on the right, none by the window
        C1GX[X] = 0.78 * sstep(-64, -180, x) * (1 - 0.35 * sstep(-220, -300, x)) + 0.36 * sstep(72, 200, x) * (1 - 0.3 * sstep(240, 300, x));
        const env = sstep(-282, -228, x) * (1 - sstep(-122, -56, x));
        if (env <= 0) { C1AQ[X] = 0; continue; }
        C1AE[X] = -44 - 0.21 * (x + 250) + 5 * Math.sin(x * 0.034 + zP(t, 1)) + 2.2 * Math.sin(x * 0.105 - zP(t, 2));
        const r = 0.5 + 0.5 * Math.sin(x * 0.2 + 2.1 * Math.sin(x * 0.041 + zP(t, 1)) + zP(t, 1)), r2 = 0.5 + 0.5 * Math.sin(x * 0.62 - 1.2 * Math.sin(x * 0.085 - zP(t, 2)) + zP(t, 3));
        C1AQ[X] = env * (0.5 + 0.32 * r + 0.18 * r2) * 0.62 * sstep(0.3, 0.75, u);   // (gone by the time L2's own aurora is in view)
      }
      const mx0 = C1MX0, mx1 = C1MX0 + (C1MW - 1) * C1MC;
      for (let Y = c1Y0; Y <= c1Y1; Y++) {
        const y = (Y + 0.5 - 135) / u, o = Y * W;
        if (y > 23) { for (let X = c1X0; X <= c1X1; X++) if (!c1Z[o + X]) BUF[o + X] = 139; continue; }   // (never: the ground is whole)
        const g = sstep(-26, -100, y), gy = y < 20 ? Math.exp(-(20 - y) / 13) : 1, af = 1 - sstep(-128, -168, y);
        const mwr = y >= C1MY0 && y < C1MY0 + (C1MH - 1) * C1MC;
        for (let X = c1X0; X <= c1X1; X++) {
          const i = o + X; if (c1Z[i]) continue;
          const b = bay(X, Y); let c = b < g ? 134 : 135;
          const G = C1GX[X] * gy;
          if (G > 0.02) { const k = fl(G * 3 + b); if (k > 0) c = k === 1 ? 136 : k === 2 ? 137 : 138; }
          const aq = C1AQ[X];
          if (aq > 0) {
            const d = C1AE[X] - y, p = d < 0 ? (d > -6 ? (1 + d / 6) * (1 + d / 6) : 0) : Math.exp(-d / 30) * Math.min(1, 0.45 + d * 0.12), A = p * aq * af;
            if (A > 0.04) { const R = bay(X + 4, Y + 2) < sstep(6, 40, d) ? C1AUC : C1AUG, k = fl(A * 5 + b); const cc = R[k > 5 ? 5 : k]; if (cc >= 0) c = cc; }
          }
          if (mwr) {
            const x = (X + 0.5 - 240) / u;
            if (x > mx0 && x < mx1) {
              const I = c1MW(x, y);
              if (I > 0.03) {
                const fx = fl((x - C1MX0) / C1MC), fy = fl((y - C1MY0) / C1MC), R = C1MWH[fy * C1MW + fx] ? C1MWV : C1MWR;
                const k = fl(I * 2.7 + bay(X + 5, Y + 3)), cc = R[k > 3 ? 3 : k]; if (cc >= 0) c = cc;
              }
            }
          }
          BUF[i] = c;
        }
      }
    }
    // stars at every scale: octaves of cells, each octave's stars fading in as their cells grow on screen, so the sky holds
    // about one star per 150 screen pixels at any zoom (L0's density) and never swims; the Milky Way holds more
    const C1BRIGHT = [[-205, -88, 1], [-148, -37, 0], [-62, -97, 2], [56, -71, 0], [151, -101, 1], [204, -27, 2], [-246, -150, 0], [121, -160, 2], [-21, -151, 1], [262, -122, 0], [-108, -131, 1], [-178, -60, 2], [88, -38, 1]];
    function c1Stars(V, t) {
      const u = V.u, xa = Math.max(-420, V.lx(c1X0)), xb = Math.min(420, V.lx(c1X1)), ya = Math.max(-420, V.ly(c1Y0)), yb = Math.min(V.ly(c1Y1), 22);
      if (yb < ya) return;
      for (let k = 0; k < 10; k++) {
        const cs = 1.875 * (1 << k), pc = cs * u; if (pc < 7) continue; if (cs > 1000) break;
        const fade = sstep(7, 14, pc), sd = 1700 + k * 17;
        const i0 = fl(xa / cs), i1 = fl(xb / cs), j0 = fl(ya / cs), j1 = fl(yb / cs);
        for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) {
          for (let m = 0; m < 3; m++) {
            const so = sd + m * 7, x = (ii + ih(ii, jj, so + 1)) * cs, y = (jj + ih(ii, jj, so + 2)) * cs;
            if (m === 0) { if (ih(ii, jj, so) > fade) continue; }
            else { const mw = c1MW(x, y); if (mw < 0.08 || ih(ii, jj, so) > fade * mw * 1.4) continue; }
            const X = fl(240 + x * u), Y = fl(135 + y * u); if (X < c1X0 || X > c1X1 || Y < c1Y0 || Y > c1Y1) continue;
            const i = Y * W + X; if (c1Z[i]) continue;
            const b = ih(ii, jj, so + 3) * (m ? 0.7 : 1), tw = 0.5 + 0.5 * Math.sin(zP(t, 1 + fl(ih(ii, jj, so + 4) * 4)) + 6.28 * ih(ii, jj, so + 5)), lv = b * b * (0.55 + 0.45 * tw), hue = ih(ii, jj, so + 6);
            let c = lv > 0.62 ? 22 : lv > 0.4 ? 21 : lv > 0.22 ? 20 : lv > 0.1 ? 19 : 138;
            if (lv > 0.22 && hue < 0.08) c = lv > 0.45 ? 16 : 15; else if (lv > 0.22 && hue > 0.9) c = lv > 0.45 ? 148 : 147;
            BUF[i] = c;
            if (lv > 0.62 && u >= 0.7) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = X + ox, yy = Y + oy; if (xx >= c1X0 && xx <= c1X1 && yy >= c1Y0 && yy <= c1Y1 && !c1Z[yy * W + xx]) BUF[yy * W + xx] = 19; }
          }
        }
      }
      // a few bright stars, with soft crosses of light
      for (const [x, y, hu] of C1BRIGHT) {
        const X = V.X(x), Y = V.Y(y); if (X < c1X0 || X > c1X1 || Y < c1Y0 || Y > c1Y1 || c1Z[fl(Y) * W + fl(X)]) continue;
        const tw = 0.5 + 0.5 * Math.sin(zP(t, 2 + (hu | 0)) + x);
        if (u < 0.3) { P(X, Y, 21); continue; }
        glow(X, Y, 5 + 3 * tw, hu === 1 ? T_GOLD : T_BL, 0.22);
        sparkle(X, Y, 1.6 + 2.2 * tw, 22, hu === 1 ? 15 : hu === 2 ? 147 : 20);
      }
    }

    /* ---------------------------------------------------------------- fireflies, at every depth */
    // ours: depth band j, x at nominal size, h height above the ground (band units), the loops they fly, their blinking
    const C1FF = [];
    for (let k = 0; k < 400 && C1FF.length < 96; k++) {
      const r = (n) => ih(k, n, 1801), g = r(1), j = g < 0.34 ? r(2) * 4.5 : g < 0.78 ? 4 + r(2) * 11 : 15 + r(2) * 15, s = c1Pow(j);
      const x = (r(3) - 0.5) * 2 * (290 + 4 * j), h = 0.6 + Math.pow(r(4), 1.6) * (j < 4.5 ? 26 : 9), ax = 0.4 + r(5) * 1.4, ay = 0.25 + r(6) * 0.8;
      const yb = c1Base(j, x), y = yb - h * s;
      if (y < -96 || y > 210) continue;
      if (Math.abs(x) < 46 + ax * s && y - ay * s < 27) continue;          // never in front of the window
      C1FF.push({ x, j, h, ax, ay, nx: 1 + fl(r(7) * 2), ny: 1 + fl(r(8) * 3), p1: r(9) * TAU, p2: r(10) * TAU, p3: r(11) * TAU, nb: 3 + fl(r(12) * 5), br: 0.6 + 0.4 * r(13) });
    }
    // and a few that keep company: by the mushrooms, by the brow's flowers, by the big clock
    for (const [x, j, h, ax, ay, nb] of [[127.5, 11.3, 2.9, 0.5, 0.3, 4], [-49, 0.6, 11, 1.2, 1.4, 5], [53, 0.5, 15, 1.4, 1.2, 3], [-96, 20.4, 2.6, 0.45, 0.25, 3], [-160, 19.3, 5.5, 0.9, 0.6, 4], [44, 0.4, 3.2, 0.5, 0.5, 6], [-46, 0.3, 4.5, 0.6, 0.4, 4]])
      C1FF.push({ x, j, h, ax, ay, nx: 1, ny: 2, p1: x, p2: j, p3: h, nb, br: 1 });
    // L0's own fireflies (in its units), flying here too so the window's edge cannot be seen
    const C1L0F = [];
    for (let k = 0; k < 16; k++) {
      const air = k < 5;
      C1L0F.push({ x: air ? [-196, -168, 204, 218, -222][k] : lerp(-226, 226, ih(k, 1, 591)), y: air ? [42, 96, 74, -12, -40][k] : lerp(132, 172, ih(k, 2, 591)),
        ax: 6 + 10 * ih(k, 3, 591), ay: 4 + 6 * ih(k, 4, 591), nx: 1 + fl(ih(k, 5, 591) * 2), ny: 2 + fl(ih(k, 6, 591) * 2), ph: ih(k, 7, 591) * TAU, nb: 3 + fl(ih(k, 8, 591) * 4) });
    }
    const C1CX = new Float32Array(160), C1CY = new Float32Array(160), C1CR = new Float32Array(160), C1CB = new Float32Array(160), C1CZ = new Uint8Array(160);
    function c1Flies(V, t) {
      const u = V.u; let n = 0;
      for (const F of C1FF) {
        const pulse = Math.sin(zP(t, F.nb) + F.p3); if (pulse <= 0.08) continue;
        const b = Math.pow(pulse, 1.5) * F.br, s = c1Pow(F.j);
        const x = F.x + F.ax * s * Math.sin(zP(t, F.nx) + F.p1), y = c1Base(F.j, x) - F.h * s + F.ay * s * Math.sin(zP(t, F.ny) + F.p2);
        const X = V.X(x), Y = V.Y(y), rl = Math.max(2.5, 1.15 * s * u);
        if (X < c1X0 - rl || X > c1X1 + rl || Y < c1Y0 - rl || Y > c1Y1 + rl) continue;
        c1Light(X, Y, rl, 0.62 * b);
        if (s * u > 2.2) glow(X, Y, 3 * s * u, T_GOLD, 0.2 * b);
        C1CX[n] = X; C1CY[n] = Y; C1CR[n] = 0.1 * s * u; C1CB[n] = b; C1CZ[n] = c1Zof(F.j); n++;
      }
      for (let k = 0; k < n; k++) {
        const X = C1CX[k], Y = C1CY[k], rc = C1CR[k], b = C1CB[k], z = C1CZ[k];
        if (rc < 0.8) { c1Dot(X, Y, 0.5, z, b > 0.55 ? 60 : b > 0.3 ? 59 : 58); continue; }
        c1Dot(X, Y, rc + 0.6, z, 58); c1Dot(X, Y, rc, z, 59); c1Dot(X - 0.25 * rc, Y - 0.25 * rc, rc * 0.55, z, 60);
        if (b > 0.6 && rc > 1.3) { const L = Math.round(rc * 1.6 + 2 * b); for (let q = 1; q <= L; q++) { const c = q < L * 0.5 ? 59 : 15; c1Dot(X + rc + q, Y, 0.5, z, c); c1Dot(X - rc - q, Y, 0.5, z, c); c1Dot(X, Y + rc + q, 0.5, z, c); c1Dot(X, Y - rc - q, 0.5, z, c); } }
      }
      if (u < 0.4) return;
      // L0's: the same lights, the same places (its units / 8)
      const u0 = u / 8;
      for (const f of C1L0F) {
        const x = f.x + f.ax * Math.sin(zP(t, f.nx) + f.ph), y = f.y + f.ay * Math.sin(zP(t, f.ny) + f.ph * 1.3), bb = 0.5 + 0.5 * Math.sin(zP(t, f.nb) + f.ph * 2.1), b = bb * bb;
        if (b <= 0.03) continue;
        const X = V.X(x / 8), Y = V.Y(y / 8);
        if (X < -24 || X > W + 24 || Y < c1R0 || Y > c1R1) continue;
        c1Light(X, Y, Math.max(2.5, 8 * u0), 0.6 * b);
        c1Dot(X, Y, 0.5, 254, b > 0.55 ? 60 : b > 0.3 ? 59 : 58);
      }
      // and L0's visitor, the firefly that comes to the snail's face (it starts just inside the window's edge)
      if (t > 1.1 && t < 3.6) {
        const p = (t - 1.1) / 2.5, x = lerp(238, 40, p) + 10 * Math.sin(p * 5.1), y = lerp(84, -30, p) + 8 * Math.sin(p * 9.4 + 0.6);
        const a = sstep(0, 0.13, p) * (1 - sstep(0.84, 1, p)), b = a * (0.72 + 0.28 * Math.sin(zP(t, 24)));
        if (b > 0.03) c1Light(V.X(x / 8), V.Y(y / 8), Math.max(2.5, 17 * u0), 0.95 * b);
      }
    }

    /* ---------------------------------------------------------------- the whole layer */
    function c1Draw(V, t) {
      const u = V.u, bx = V.box;
      c1X0 = bx[0]; c1X1 = bx[2]; c1Y0 = Math.max(bx[1], c1R0); c1Y1 = Math.min(bx[3], c1R1);
      if (c1X1 < c1X0 || c1Y1 < c1Y0) return;
      c1Z.fill(0, c1Y0 * W, (c1Y1 + 1) * W);
      // the window's full inside belongs to the snail (L0 always covers it while we are this big): leave it
      if (u >= 0.125) {
        const Xa = Math.max(c1X0, Math.ceil(240 - 29.95 * u - 0.5)), Xb = Math.min(c1X1, fl(240 + 29.95 * u - 0.5));
        const Ya = Math.max(c1Y0, Math.ceil(135 - 16.95 * u - 0.5)), Yb = Math.min(c1Y1, fl(135 + 16.95 * u - 0.5));
        if (Xb >= Xa) for (let Y = Ya; Y <= Yb; Y++) c1Z.fill(255, Y * W + Xa, Y * W + Xb + 1);
      }
      c1Props(V, t);
      c1Meadow(V, t);
      c1Trees(V);
      c1Sky(V, t);
      c1Stars(V, t);
      c1Seeds(V, t);
      c1Flies(V, t);
    }
    ZL[1] = { name: 'meadow', draw: c1Draw, zbuf: c1Z };
  }

  /* ================================================================ Carry · L2 — the valley
     Pulled back from the meadow, we see its hill as a dark rounded brow in the middle distance (its top at y ≈ 2.5 by the
     window, where L1's brow is), sloping away to either side. Past it the land opens: on the right a river winding down
     out of the far hills, a village with warm windows on its bank; on the left a forest; far mountains on the horizon,
     which is the planet's curve (a circle of radius 4480 about (0, +4480)). In front of the hill, near us, dark grass and
     fireflies. Above: the night, the Milky Way rising out of the window, and the aurora in tall shimmering curtains. */
  {
    const C2R = 4480, yH = (x) => C2R - Math.sqrt(Math.max(0, C2R * C2R - x * x));      // the true horizon
    // the meadow hill's outline: level by the window (L1's brow), then falling away
    const yB = (x) => { const a = Math.max(0, Math.abs(x) - 30); return 2.55 + (Math.abs(x) - 30 > 0 ? 0.0011 * a * a : 0) + 0.12 * Math.sin(x * 0.4) * sstep(30, 60, Math.abs(x)); };
    // the far mountains: height above the horizon (only away from the window)
    const C2PK = []; for (let k = 0; k < 40; k++) C2PK.push([(ih(k, 1, 2202) - 0.5) * 900, 6 + ih(k, 2, 2202) * 20, 0.55 + ih(k, 3, 2202) * 0.5]);
    // the far mountains: overlapping peaks (a ridge of triangles with jagged slopes), only away from the window
    const mt = (x) => { let m = 2 + 2 * vn(x * 0.05, 0, 1, 2201); for (const [px, h, sl] of C2PK) { const v = h - Math.abs(x - px) * sl + 1.5 * (vn(x * 0.3, px, 1, 2203) - 0.5); if (v > m) m = v; } return sstep(45, 120, Math.abs(x)) * m; };
    // which side of its peak a mountain point faces (−1 lit, toward the aurora on the left; +1 in shadow)
    const mside = (x) => { let best = -1e9, sd = 1; for (const [px, h, sl] of C2PK) { const v = h - Math.abs(x - px) * sl; if (v > best) { best = v; sd = x < px ? -1 : 1; } } return sd; };
    // the river: a path down the valley on the right, as [x, y, width] points
    const RIV = [[64, 0.3, 0.6], [92, 2.5, 1.0], [130, 5, 1.6], [170, 7.5, 2.3], [210, 11, 3.4], [250, 16, 4.6], [300, 24, 6.4], [360, 36, 8.5], [430, 54, 11]];
    function c2River(x, y) {
      let best = 1e9, w = 0;
      for (let i = 0; i + 1 < RIV.length; i++) {
        const [ax, ay, aw] = RIV[i], [bx, by, bw] = RIV[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, q = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1);
        const px = ax + dx * q + Math.sin(q * PI * 2 + i) * 6, py = ay + dy * q, d = Math.hypot(x - px, (y - py) * 3);
        if (d < best) { best = d; w = lerp(aw, bw, q); }
      }
      return best / w;                                      // < 1 inside
    }
    // the village: houses on the river bank (x, y, w, h, window seed)
    const HOUSES = [];
    for (let k = 0; k < 26; k++) { const x = 168 + ih(k, 1, 2210) * 62, y = 13 + ih(k, 2, 2210) * 9 + (x - 168) * 0.06; HOUSES.push([x, y, 1.6 + ih(k, 3, 2210) * 2.2, 1.2 + ih(k, 4, 2210) * 1.4, k]); }
    HOUSES.sort((a, b) => a[1] - b[1]);
    const TREES = []; for (let k = 0; k < 220; k++) { const x = -250 + ih(k, 1, 2220) * 200, y = 3 + Math.max(0, (-x - 50)) * 0.06 + ih(k, 2, 2220) * 14; TREES.push([x, y, 1.6 + ih(k, 3, 2220) * 2.6 + y * 0.04]); }
    TREES.sort((a, b) => a[1] - b[1]);
    const FLIES = []; for (let k = 0; k < 90; k++) FLIES.push([(ih(k, 1, 2230) - 0.5) * 620, 4 + Math.pow(ih(k, 2, 2230), 1.6) * 140, ih(k, 3, 2230), 1 + fl(ih(k, 4, 2230) * 3)]);
    // L1's meadow, measured: its brightness by depth below the brow (L2 units), and a dither between two greens to match it
    const C2LD = [[0.5, 56], [1.5, 45], [3, 32], [4.5, 21], [6, 15], [7.5, 12], [9, 10], [11, 9], [40, 8], [90, 5]];
    const c2Lum = (dep) => { if (dep <= C2LD[0][0]) return C2LD[0][1]; for (let i = 1; i < C2LD.length; i++) if (dep < C2LD[i][0]) { const [a0, l0] = C2LD[i - 1], [a1, l1] = C2LD[i]; return lerp(l0, l1, (dep - a0) / (a1 - a0)); } return 5; };
    const C2G = [[0, 0], [1, 7], [23, 25], [24, 43], [141, 57], [142, 83]];
    // tables: the dither pair for each depth, a tenth of a unit apart
    const C2TA = new Uint8Array(1000), C2TB = new Uint8Array(1000), C2TF = new Float32Array(1000);
    function c2Pair(L) { for (let i = 1; i < C2G.length; i++) if (L <= C2G[i][1]) { const [a, la] = C2G[i - 1], [b, lb] = C2G[i]; return [a, b, (L - la) / (lb - la)]; } return [142, 142, 0]; }
    for (let i = 0; i < 1000; i++) { const dep = i / 10, pr = c2Pair(dep < 0.5 ? 64 : c2Lum(dep)); C2TA[i] = pr[0]; C2TB[i] = pr[1]; C2TF[i] = pr[2]; }
    function c2Draw(V, t) {
      const u = V.u, [X0, Y0, X1, Y1] = V.box, a1 = zP(t, 1), a2 = zP(t, 2), Yt = Math.max(Y0, LB), Yb = Math.min(Y1, H - 1 - LB);
      for (let X = X0; X <= X1; X++) {
        const x = V.lx(X), h = yH(x), b = yB(x), m = h - mt(x);
        // the aurora's shape in this column: a ribbon whose lower edge waves, folded by the wind (its rays: zAur)
        const fold = x + 26 * Math.sin(x / 95 + a1) + 9 * Math.sin(x / 29 - a2);
        const bot = -30 + 9 * Math.sin(x / 80 + a1) - 5 * Math.sin(x / 26 + a2) - 0.05 * Math.max(0, -x - 60);
        const env = (0.55 + 0.45 * Math.sin(x / 130 + 0.6 + a1 * 0.5)) * (1 - sstep(120, 300, x)) * sstep(-460, -300, x);
        // where the Milky Way crosses this column (it rises out of the window up to the left): its centre y and half-width
        const mwY = (x - 26) / 0.89, mwW = 10 + 0.42 * Math.max(0, -mwY), msd = mside(x) < 0, hc = V.hole && X >= V.hole[0] && X <= V.hole[2];
        for (let Y = Yt; Y <= Yb; Y++) {
          if (hc && Y >= V.hole[1] && Y <= V.hole[3]) { Y = V.hole[3]; continue; }
          const y = V.ly(Y), d = bay(X, Y);
          let c;
          if (y < m && y < b) {
            // the sky: a quick glow at the horizon (as L1 has it), then deep night, deepening upward
            c = y > -1.6 ? 136 : y > -6 ? (d < (y + 6) / 4.4 ? 136 : 135) : y > -11 ? (d < (y + 11) / 5 ? 135 : 134) : y > -150 ? 134 : (d < 0.5 ? 134 : 2);
            if (y < 0) {
              const k = 1 - Math.abs(y - mwY) * 0.89 / mwW;
              if (k > 0) { const n = vn(x * 0.06, y * 0.06, 1, 2240) * 0.8 + d * 0.2, e = Math.pow(k, 1.4) * (0.22 + n) * (0.8 + 0.2 * sstep(-60, -10, y)); if (e > 1.15 + d * 0.25) c = 56; else if (e > 0.72 + d * 0.3) c = 55; else if (e > 0.42 + d * 0.35) c = 4; else if (e > 0.18 + d * 0.3) c = 136; if (e > 0.3 && ih(fl(x * 1.5), fl(y * 1.5), 2247) < 0.05 * e) c = e > 0.7 ? 22 : 20; if (Math.abs(y - mwY - mwW * 0.3 * (n - 0.3)) * 0.89 < 0.6 * (0.5 + n) && k > 0.5 && d < 0.6) c = 134; }
              const hg = bot - y;
              if (hg > 0 && hg < 110 && env > 0.05) {
                const I = env * zAur(fold, hg) * (hg < 2.5 ? hg / 2.5 : 1) * (0.32 + 0.68 * sstep(28, 80, Math.sqrt(x * x + y * y)));
                if (I > 0.62 + d * 0.25) c = hg < 10 ? 49 : hg < 30 ? 48 : 126; else if (I > 0.4 + d * 0.25) c = hg < 14 ? 48 : hg < 40 ? 126 : 125; else if (I > 0.22 + d * 0.22) c = hg < 20 ? 125 : 117; else if (I > 0.1 + d * 0.18) c = hg < 26 ? 124 : 116;
              }
            }
          } else if (y < b && y < h) {
            // the far mountains, dark; snow on the high ones, lit cyan along their edges by the aurora
            const top = y - m, hm = h - m, lit = msd;
            c = lit ? (d < 0.5 ? 135 : 134) : (d < 0.6 ? 2 : 134);
            if (hm > 11 && top < (hm - 11) * 0.7 + 0.6 * vn(x * 0.4, y * 0.4, 1, 2204)) c = lit ? (d < 0.55 ? 138 : 137) : (d < 0.5 ? 136 : 135);   // snow on the high peaks
            if (top < 0.6 / Math.max(0.3, u) && lit) c = 137;
            if (y > h - 2.5) c = d < 0.5 ? 135 : 134;
          } else if (y < b) {
            // the land past the hill: the valley floor, darker nearer, fields; the river; distance haze at the horizon
            const near = clamp((y - h) / 70, 0, 1), hz = clamp((y - h) / 5, 0, 1);
            c = hz < 0.5 + (d - 0.5) * 0.6 ? 135 : near < 0.25 ? (d < 0.35 ? 140 : 139) : near < 0.6 ? (d < 0.3 ? 139 : 24) : (d < 0.5 ? 24 : 23);
            if (near > 0.08 && vn(x * 0.07, y * 0.35, 1, 2242) > 0.7) c = near < 0.4 ? 140 : 139;
            if (x > 50 && c2River(x, y) < 1) { const sw = Math.sin(x * 0.7 + y * 3 + a2 * 2) + Math.sin(x * 0.23 - a1); c = sw > 1.3 ? 61 : sw > 0.6 ? 147 : sw > -0.3 ? 137 : 117; }
          } else {
            // the hill: a faint lit brow, then the dark of its face (as dark as L1's ground below its brow), black nearer
            const dep = y - b;
            // the brightness L1's meadow has at this depth below its brow (measured), dithered between two greens; blades of
            // grass as short vertical strokes a little brighter, sparser nearer us
            const di = Math.min(999, fl(dep * 10));
            c = d < C2TF[di] ? C2TB[di] : C2TA[di];
            const cw = dep < 22 ? 0.5 : 1.1, bx = fl(x / cw), ch = dep < 22 ? 2 : 4, o2 = ih(bx, 7, 2245) * ch, by = fl((y + o2) / ch), g = ih(bx, by, 2243), fy = frac((y + o2) / ch);
            if (dep > 0.6 && g < (dep < 14 ? 0.22 : 0.08 * Math.max(0, 1 - dep / 90))) c = dep < 2.5 ? (fy < 0.4 ? 142 : 141) : dep < 5 ? (fy < 0.4 ? 141 : 140) : dep < 10 ? (fy < 0.4 ? 140 : 139) : (fy < 0.4 ? 139 : 23);
          }
          BUF[Y * W + X] = c;
        }
      }
      // the brow's grass fringe against the sky: fine dark blades along the hill's outline
      if (u > 1.6) for (let X = X0; X <= X1; X++) { const x = V.lx(X), b = yB(x), k = fl(x * 3); if (ih(k, 1, 2244) > 0.55) continue; const hh = (0.4 + ih(k, 2, 2244) * 0.9) * (1 + 0.15 * Math.sin(zP(t, 1) + x)); const Yb = fl(V.Y(b)), Yt2 = fl(V.Y(b - hh)); for (let Y = Math.max(LB, Yt2); Y < Math.min(H - LB, Yb); Y++) BUF[Y * W + X] = ih(k, 3, 2244) < 0.4 ? 139 : 24; }
      // stars in the sky (behind nothing but the sky: drawn only where the sky is)
      zStars(V, t, -420, -420, 420, 0, 6, 2250, [136, 19, 20, 21, 22], (x, y) => y < Math.min(yH(x) - mt(x), yB(x)));
      // the forest on the left: conifers, far to near
      for (const [x, y, s] of TREES) {
        if (y > yB(x) - 0.2 || !V.vis(x - s, y - s * 3, x + s, y)) continue;
        const S = V.S(s); if (S < 0.4) continue;
        const bx = V.X(x), by = V.Y(y);
        if (S < 1.5) { P(bx, by - 1, 1); P(bx, by - 2, 1); continue; }
        for (let k = 0; k < S * 3; k++) { const w = (k / (S * 3)) * S * 0.9; for (let i = -w; i <= w; i++) P(bx + i, by - S * 3 + k, k < 2 ? 139 : i < -w * 0.4 ? 24 : 1); }
      }
      // the village: small dark houses, warm windows flickering, a few lamps on the bank
      for (const [x, y, w, h, s] of HOUSES) {
        if (!V.vis(x - w, y - h * 2, x + w, y)) continue;
        const S = V.S(1);
        if (S * w < 1.2) { P(V.X(x), V.Y(y), ih(s, 1, 2211) < 0.6 ? 144 : 145); continue; }
        rectF(V.X(x - w / 2), V.Y(y - h), V.S(w), V.S(h), 2);
        z5Tri(V.X(x - w / 2 - 0.2), V.Y(y - h), V.X(x + w / 2 + 0.2), V.Y(y - h), V.X(x), V.Y(y - h - w * 0.55), 1);
        const lit = 0.5 + 0.5 * Math.sin(zP(t, 1 + (s % 3)) + s * 2.1) > 0.18;
        if (lit) { const wx = V.X(x - w * 0.2), wy = V.Y(y - h * 0.55), ws = Math.max(1, V.S(0.5)); rectF(wx, wy, ws, ws, s % 4 ? 144 : 145); if (u > 0.8) glow(wx, wy, Math.max(2, V.S(1.6)), T_WARM, 0.3); }
      }
      // fireflies over the hill and the near grass
      for (const [x, y, ph, n] of FLIES) {
        if (y < yB(x) + 0.5) continue;
        const fx = x + 4 * Math.sin(zP(t, n) + ph * 9), fy = y + 2 * Math.sin(zP(t, n + 1) + ph * 5), on = 0.5 + 0.5 * Math.sin(zP(t, n * 2) + ph * 11);
        if (on < 0.35 || !V.vis(fx, fy, fx, fy)) continue;
        const X = V.X(fx), Y = V.Y(fy), nearF = clamp(fy / 100, 0, 1); P(X, Y, on > 0.8 ? 53 : 52); if (nearF > 0.4 && V.u > 0.6) { P(X + 1, Y, 52); P(X, Y + 1, 52); } if (V.u * (0.5 + nearF) > 0.8) glow(X, Y, 2 + V.u * (1 + 2 * nearF), T_YE, 0.28 * on);
      }
      // the near grass at the bottom edge: a dark fringe of tapered blades swaying, cut out against the hill
      if (u < 2.2) for (let k = 0; k < 160; k++) {
        const x = (ih(k, 1, 2260) - 0.5) * 840, hh = 6 + ih(k, 2, 2260) * 14, sway = (ih(k, 3, 2260) - 0.5) * 4 + 1.5 * Math.sin(zP(t, 1) + x * 0.02), y0 = 128 + ih(k, 4, 2260) * 12;
        if (!V.vis(x - 6, y0 - hh, x + 6, y0)) continue;
        const n = Math.max(2, Math.ceil(V.S(hh)));
        for (let q = 0; q < n; q++) { const f = q / n, wd = Math.max(1, V.S(1.3 * (1 - f))), px = V.X(x + sway * f * f), py = V.Y(y0 - hh * f); for (let w = 0; w < wd; w++) P(px + w, py, f > 0.8 ? (k % 3 ? 24 : 139) : f > 0.5 ? 23 : 1); }
      }
    }
    ZL[2] = { name: 'valley', draw: c2Draw };
  }

  /* ================================================================ Carry · L3 — the curve of the world
     High above the north of the world at night. The limb runs through the window (a circle of radius 560 about (0, +560)),
     curving away to either side. Above it: the valley's sky, the deep blue of the atmosphere seen edge-on, thinning into
     space; the aurora's curtains standing along the limb, brightest over the snail's valley; the Milky Way rising out of
     the window up to the left (the same band L2 has, self-similar); stars. Below it: the night side of the planet (the
     shared texture of g_planet), its cities, its clouds, its ice. */
  {
    const R3 = 560, CY3 = 560;
    function c3Draw(V, t) {
      const u = V.u, [X0, Y0, X1, Y1] = V.box, a1 = zP(t, 1), a2 = zP(t, 2), Yt = Math.max(Y0, LB), Yb = Math.min(Y1, H - 1 - LB);
      for (let X = X0; X <= X1; X++) {
        const x = V.lx(X);
        const hc = V.hole && X >= V.hole[0] && X <= V.hole[2];
        for (let Y = Yt; Y <= Yb; Y++) {
          if (hc && Y >= V.hole[1] && Y <= V.hole[3]) { Y = V.hole[3]; continue; }
          const y = V.ly(Y), dy = y - CY3, rr = Math.sqrt(x * x + dy * dy), hgt = rr - R3;
          if (hgt <= 0) continue;                                  // the planet (drawn below)
          const d = bay(X, Y);
          // the sky seen through the atmosphere's edge: L2's blues near the limb, thinning to black space
          let c = hgt < 0.25 ? 136 : hgt < 0.8 ? (d < 0.5 ? 136 : 135) : hgt < 1.6 ? (d < (1.6 - hgt) / 0.8 ? 135 : 134) : hgt < 26 ? 134 : hgt < 46 ? (d < (46 - hgt) / 20 ? 134 : 2) : hgt < 70 ? (d < (70 - hgt) / 24 ? 2 : 1) : (d < 0.15 ? 1 : 0);
          // the Milky Way, rising out of the window to the upper left (L2's band, eight times smaller)
          if (y < 0) {
            const xc = 3.25 + 0.89 * y, hw = 1.25 + 0.42 * -y, k = 1 - Math.abs(x - xc) / hw;
            if (k > 0) { const n = vn(x * 0.48, y * 0.48, 1, 2240) * 0.8 + d * 0.2, e = Math.pow(k, 1.4) * (0.22 + n) * (0.8 + 0.2 * sstep(-60, -10, y)) * (1 - 0.6 * sstep(80, 200, hgt)) * (1 - sstep(70, 230, -y)); if (e > 1.15 + d * 0.25) c = 56; else if (e > 0.72 + d * 0.3) c = 55; else if (e > 0.42 + d * 0.35) c = 4; else if (e > 0.18 + d * 0.3 && c !== 0) c = 136; if (e > 0.3 && ih(fl(x * 12), fl(y * 12), 2247) < 0.05 * e) c = e > 0.7 ? 22 : 20; }
          }
          // the aurora: curtains standing on the limb, their foot ~4 units up, rays folded and waving
          if (hgt > 2.1 && hgt < 46) {                              // (the curtains' foot is never lower than 2.1)
            const s = R3 * Math.atan2(x, CY3 - y), fold = s * 8 + 26 * Math.sin(s / 12 + a1) + 9 * Math.sin(s / 3.6 - a2);
            const bot = 3.8 + 1.1 * Math.sin(s / 10 + a1) - 0.6 * Math.sin(s / 3.2 + a2), hg = hgt - bot;
            if (hg > 0 && hg < 40) {
              const env = (0.55 + 0.45 * Math.sin(s / 16 + 0.6 + a1 * 0.5)) * Math.exp(-Math.pow(Math.max(0, Math.abs(s) - 30) / 160, 2));
              const I = env * zAur(fold, hg * 8) * (hg < 0.35 ? hg / 0.35 : 1);
              if (I > 0.62 + d * 0.25) c = hg < 1.25 ? 49 : hg < 3.75 ? 48 : 126; else if (I > 0.4 + d * 0.25) c = hg < 1.75 ? 48 : hg < 5 ? 126 : 125; else if (I > 0.22 + d * 0.22) c = hg < 2.5 ? 125 : 117; else if (I > 0.1 + d * 0.18) c = hg < 3.2 ? 124 : 116;
            }
          }
          BUF[Y * W + X] = c;
        }
      }
      // stars, only where it is dark enough (above the atmosphere's blue)
      zStars(V, t, -420, -420, 420, 60, 5, 3301, [136, 19, 20, 21, 22]);
      // the planet itself
      gPlanet(V, 0, CY3, R3, t, { glowW: 0.9, aur: 0, detail: clamp(u - 0.8, 0, 2) * 0.6, darkAt: [0, 18, 56] });
    }
    ZL[3] = { name: 'curve', draw: c3Draw };
  }

  /* ================================================================ Carry · L4 — the planet
     The whole world in space: the same texture as L3 (g_planet), its disc 70 in radius about (0, +70), so its north limb —
     the snail's — runs through the window. A thin crescent of day on the lower left (the sun is behind it, to the left),
     the night side strung with cities, the aurora's oval about the tipped north pole and its curtains standing on the limb
     over the window, the atmosphere's blue (L3's, self-similar) along the limb, a grey moon to the right, the Milky Way
     (L3's band, continued), and stars. */
  {
    const R4 = 70, CY4 = 70, MOON = [158, 22, 10];
    function c4Draw(V, t) {
      const u = V.u, [X0, Y0, X1, Y1] = V.box, a1 = zP(t, 1), a2 = zP(t, 2), Yt = Math.max(Y0, LB), Yb = Math.min(Y1, H - 1 - LB);
      for (let X = X0; X <= X1; X++) {
        const x = V.lx(X), hc = V.hole && X >= V.hole[0] && X <= V.hole[2];
        for (let Y = Yt; Y <= Yb; Y++) {
          if (hc && Y >= V.hole[1] && Y <= V.hole[3]) { Y = V.hole[3]; continue; }
          const y = V.ly(Y), dy = y - CY4, hgt = Math.sqrt(x * x + dy * dy) - R4;
          if (hgt <= 0) continue;
          const d = bay(X, Y), up = -dy / Math.sqrt(x * x + dy * dy);        // 1 over the north limb, −1 under the south
          // space, and the atmosphere's blue along the night limb (L3's sky, eight times smaller), warm where the sun is
          let c = d < 0.12 ? 1 : 0;
          const sunw = (x * GP_S[0] + dy * GP_S[1]) / (hgt + R4);
          if (sunw > 0.25) { if (hgt < 1.2 && d < (1.2 - hgt) / 1.2) c = hgt < 0.4 ? 148 : 147; }
          else c = hgt < 3.25 ? 134 : hgt < 5.75 ? (d < (5.75 - hgt) / 2.5 ? 134 : 2) : hgt < 8.75 ? (d < (8.75 - hgt) / 3 ? 2 : 1) : c;
          // the Milky Way (L3's, continued up to the left, and fading out: from out here it is no longer a band across the sky)
          if (y < 0) {
            const xc = 0.406 + 0.89 * y, hw = 0.156 + 0.42 * -y, k = 1 - Math.abs(x - xc) / hw;
            if (k > 0) { const n = vn(x * 3.8, y * 3.8, 1, 2240) * 0.8 + d * 0.2, e = Math.pow(k, 1.4) * (0.22 + n) * (0.8 + 0.2 * sstep(-7.5, -1.25, y)) * (1 - 0.6 * sstep(10, 25, hgt)) * (1 - sstep(8.75, 28.75, -y)); if (e > 1.15 + d * 0.25) c = 56; else if (e > 0.72 + d * 0.3) c = 55; else if (e > 0.42 + d * 0.35) c = 4; else if (e > 0.18 + d * 0.3 && c < 2) c = 136; }
          }
          // the aurora's curtains standing on the north limb (L3's, small now)
          if (up > 0.8 && hgt > 0.33 && hgt < 5.7) {
            const s = R4 * Math.atan2(x, -dy), fold = s * 64 + 26 * Math.sin(s * 0.67 + a1) + 9 * Math.sin(s * 2.2 - a2);
            const bot = 0.47 + 0.14 * Math.sin(s * 0.8 + a1), hg = hgt - bot;
            if (hg > 0 && hg < 5) {
              const env = (0.55 + 0.45 * Math.sin(s * 0.5 + 0.6 + a1 * 0.5)) * Math.exp(-Math.pow(Math.max(0, Math.abs(s) - 3.75) / 20, 2));
              const I = env * zAur(fold, hg * 64);
              if (I > 0.62 + d * 0.25) c = hg < 0.16 ? 49 : hg < 0.47 ? 48 : 126; else if (I > 0.4 + d * 0.25) c = hg < 0.22 ? 48 : hg < 0.62 ? 126 : 125; else if (I > 0.22 + d * 0.22) c = 125; else if (I > 0.1 + d * 0.18) c = 124;
            }
          }
          BUF[Y * W + X] = c;
        }
      }
      zStars(V, t, -420, -420, 420, 420, 4.5, 4401, [136, 19, 20, 21, 22]);
      // the world
      gPlanet(V, 0, CY4, R4, t, { glowW: 0.6, aur: 1, detail: clamp(u - 1.2, 0, 2) * 0.5, darkAt: [0, 2.25, 7] });
      // the moon: a small grey world, lit from behind and to the left (a crescent), cratered
      const [mx, my, mr] = MOON;
      if (V.vis(mx - mr, my - mr, mx + mr, my + mr)) {
        V.each(mx - mr, my - mr, mx + mr, my + mr, (x, y, X, Y) => {
          const nx = (x - mx) / mr, ny = (y - my) / mr, r2 = nx * nx + ny * ny; if (r2 > 1) return -1;
          const nz = Math.sqrt(1 - r2), l = nx * GP_S[0] + ny * GP_S[1] + nz * GP_S[2], cr = vn(nx * 6 + 9, ny * 6, 1, 4402), d = bay(X, Y);
          if (l < 0) return r2 > 0.9 ? 1 : (cr > 0.62 && d < 0.3 ? 2 : 1);              // earthshine on the dark side
          const v = l * 3.2 + (cr > 0.6 ? -0.8 : 0) + d * 0.7;
          return v > 2.4 ? 22 : v > 1.6 ? 21 : v > 0.9 ? 20 : v > 0.4 ? 19 : 18;
        });
      }
    }
    ZL[4] = { name: 'planet', draw: c4Draw };
  }

  /* ================================================================ Carry · L5 — the sun and its planets
     The snail's world (g_planet, radius 8.75 about (0, +8.75)) sits on its orbit at the origin, its crescent toward the sun.
     The sun blazes at (−122, +77.6), lower left (along g_planet's light), lighting everything. Faint orbits ring it; a small
     inner world runs round it once a loop; a pale cloudy one; a red one; an asteroid belt; a ringed giant; a far ice world.
     All of it fades toward the edges of the frame, and space itself turns from black to the galaxy's own light (L6's, lent
     through ZSH), so that inside the galaxy the solar system is a small bright knot in the arm's glow, with no edge. */
  {
    const SUN = [-122, 77.6, 20], DPL = Math.hypot(122, 77.6 - 8.75);
    // the other worlds: [orbit radius, angle (rad, about the sun), turns per loop, radius, colours [dark, mid, light], ringed]
    const WORLDS = [
      [58, -0.9, 1, 2.6, [32, 33, 34], 0],
      [96, -1.3, 0, 4.4, [65, 64, 22], 0],
      [196, -0.78, 0, 3.6, [11, 12, 13], 0],
      [300, -0.42, 0, 15, [29, 31, 16], 1],
      [370, -0.47, 0, 6, [117, 118, 119], 0],
    ];
    const BELT = []; for (let k = 0; k < 300; k++) BELT.push([250 + (ih(k, 1, 5501) - 0.5) * 22, ih(k, 2, 5501) * TAU, ih(k, 3, 5501)]);
    const C5HAZE = [4, 19, 20, 21, 22];
    const edgeFade = (x, y) => 1 - sstep(170, 250, Math.max(Math.abs(x) * 0.72, Math.abs(y) * 1.25));
    // how much of the galaxy's light shows: none about the sun and its worlds, all of it where L6's window ends
    // (a soft, ragged-edged dark pocket about the origin: black at this layer's window, full light by L6's window's edge)
    const gwE = (x, y, a, b, c, d) => sstep(0.18, 0.64, Math.hypot(x / 288, y / 176) + 0.05 * a * b + 0.035 * c * d);
    const galW = (x, y) => gwE(x, y, Math.sin(x * 0.019 + 1.3), Math.sin(y * 0.023 - 0.7), Math.sin(x * 0.047 + 2.1), Math.sin(y * 0.041 - 1.9));
    const GWX = new Float32Array(W * 2), GWY = new Float32Array(H * 2);
    function c5Draw(V, t) {
      const u = V.u, G = ZSH.galaxy, [gcr, gsr] = G.prep(t);
      // (the galaxy's faint nebula, nearly flat over this small patch of it: a plane through its value here)
      const nv = (x, y) => vn(x * 0.004, y * 0.004, 1, 6103), neb = [nv(0, 0), (nv(20, 0) - nv(-20, 0)) / 40, (nv(0, 20) - nv(0, -20)) / 40];
      // space: the galaxy's light, fading to black about the sun
      for (let X = 0; X < W; X++) { const x = V.lx(X); GWX[X * 2] = Math.sin(x * 0.019 + 1.3); GWX[X * 2 + 1] = Math.sin(x * 0.047 + 2.1); }
      for (let Y = 0; Y < H; Y++) { const y = V.ly(Y); GWY[Y * 2] = Math.sin(y * 0.023 - 0.7); GWY[Y * 2 + 1] = Math.sin(y * 0.041 - 1.9); }
      V.each(-420, -420, 420, 420, (x, y, X, Y) => {
        const d = bay(X, Y), w = gwE(x, y, GWX[X * 2], GWY[Y * 2], GWX[X * 2 + 1], GWY[Y * 2 + 1]);
        if (w <= 0) return d < 0.12 ? 1 : 0;
        let c = G.pix(x / 8, y / 8, X, Y, gcr, gsr, u * 8, w, neb);
        if (c === 0 && d < 0.12 * (1 - w)) c = 1;
        return c;
      });
      // (L4's sky near the window, thinning to the galaxy's sparser, greyer stars where its light comes in)
      G.fine(V, gcr, gsr, u * 8, 8, galW);
      zStars(V, t, -420, -420, 420, 420, 4, 5503, [136, 19, 20, 21, 22], (x, y) => { const w = galW(x, y); return ih(fl(x * 64), fl(y * 64), 5506) > 1 - 0.5 * w ? false : w > 0.45 ? C5HAZE : true; });
      // the sun's light on space: a broad warm glow (L6 draws the same, an eighth the size)
      zGlow(V, SUN[0], SUN[1], 140, T_WARM, 0.32); zGlow(V, SUN[0], SUN[1], 60, T_GOLD, 0.45);
      // the orbits: fine dotted rings about the sun, fading at the frame's edge
      const orbit = (r, c) => { const n = Math.ceil(TAU * r * u * 0.5); for (let k = 0; k < n; k++) { const a = k / n * TAU, x = SUN[0] + Math.cos(a) * r, y = SUN[1] + Math.sin(a) * r, X = V.X(x), Y = V.Y(y); if (X < V.box[0] || X > V.box[2] || Y < Math.max(LB, V.box[1]) || Y > Math.min(H - 1 - LB, V.box[3])) continue; const f = edgeFade(x, y) * sstep(0.12, 0.5, u); if (f > 0.02 && bay(X, Y) < f * 0.8 && (k & 1)) P(X, Y, c); } };
      for (const Wd of WORLDS) orbit(Wd[0], 136);
      orbit(DPL, 137);
      // the asteroid belt, turning slowly
      for (const [r, a0, m] of BELT) { const a = a0 + zP(t, 1) * 0.05, x = SUN[0] + Math.cos(a) * r, y = SUN[1] + Math.sin(a) * r, X = V.X(x), Y = V.Y(y); if (X < V.box[0] || X > V.box[2] || Y < Math.max(LB, V.box[1]) || Y > Math.min(H - 1 - LB, V.box[3])) continue; if (bay(X, Y) < edgeFade(x, y) && m < u * 1.4 + 0.08) P(X, Y, m > 0.7 ? 122 : 121); }
      // the worlds, each lit from the sun's side
      for (const [r, a0, n, pr, cols, ringed] of WORLDS) {
        const a = a0 + zP(t, n), x = SUN[0] + Math.cos(a) * r, y = SUN[1] + Math.sin(a) * r, f = edgeFade(x, y);
        if (f < 0.05 || !V.vis(x - pr * 2.4, y - pr * 2.4, x + pr * 2.4, y + pr * 2.4)) continue;
        const lx = (SUN[0] - x) / Math.hypot(SUN[0] - x, SUN[1] - y), ly = (SUN[1] - y) / Math.hypot(SUN[0] - x, SUN[1] - y);
        const ringPx = (x2, y2, front) => { const dx = x2 - x, dy = y2 - y, ex = dx, ey = dy / 0.32, rr = Math.hypot(ex, ey) / pr; if (rr < 1.45 || rr > 2.25) return -1; if ((dy > 0) !== front) return -1; return rr > 2.0 ? 30 : rr > 1.7 ? 31 : 16; };
        if (ringed) V.each(x - pr * 2.3, y - pr, x + pr * 2.3, y + pr, (x2, y2) => ringPx(x2, y2, false));
        V.each(x - pr, y - pr, x + pr, y + pr, (x2, y2, X, Y) => {
          const nx = (x2 - x) / pr, ny = (y2 - y) / pr, r2 = nx * nx + ny * ny; if (r2 > 1) return -1;
          const nz = Math.sqrt(1 - r2), l = nx * lx * 0.9 + ny * ly * 0.9 + nz * 0.25, d = bay(X, Y);
          if (l < 0) return d < 0.15 ? cols[0] : 1;
          const band = ringed ? Math.sin(ny * 9 + Math.sin(nx * 3) * 0.6) * 0.5 : 0, v = l * 2.6 + band + d * 0.7;
          return v > 2.1 ? cols[2] : v > 1.1 ? cols[1] : cols[0];
        });
        if (ringed) V.each(x - pr * 2.3, y - pr, x + pr * 2.3, y + pr, (x2, y2) => ringPx(x2, y2, true));
      }
      // the snail's world: the same planet as L3 and L4, its crescent toward the sun
      gPlanet(V, 0, 8.75, 8.75, t, { glowW: 0.5, aur: 1 });
      // the sun: a white-hot disc in rings of gold, its corona's tongues turning, rays thinning out into the dark
      const [sx, sy, sr] = SUN;
      if (V.vis(sx - sr * 3, sy - sr * 3, sx + sr * 3, sy + sr * 3)) {
        V.each(sx - sr * 2.2, sy - sr * 2.2, sx + sr * 2.2, sy + sr * 2.2, (x, y, X, Y) => {
          const dx = x - sx, dy = y - sy, r = Math.hypot(dx, dy) / sr, an = Math.atan2(dy, dx), d = bay(X, Y);
          if (r < 0.62) return 22;
          if (r < 0.8) return d < (0.8 - r) * 5 ? 22 : 108;
          if (r < 0.92) return d < 0.5 ? 108 : 16;
          if (r < 1) return d < 0.5 ? 16 : 15;
          const tongue = 1 + 0.35 * Math.max(0, Math.sin(an * 7 + zP(t, 1)) * Math.sin(an * 3 - zP(t, 2))) + 0.15 * vn(an * 5 + zP(t, 1), 0, 1, 5504);
          if (r < tongue) { const e = (r - 1) / (tongue - 1); return e < 0.35 ? 15 : e < 0.7 ? (d < 0.6 ? 58 : 14) : (d < 0.45 ? 14 : -1); }
          return -1;
        });
        for (let k = 0; k < 12; k++) {
          const a = k / 12 * TAU + zP(t, 1) * 0.1, L = sr * (2.0 + 0.8 * Math.sin(zP(t, 2) + k * 1.7)), r0 = sr * 1.05, n = Math.ceil(V.S(L - r0) * 1.4);
          for (let m = 0; m <= n; m++) {
            const f = m / Math.max(1, n), rr = r0 + (L - r0) * f, X = fl(V.X(sx + Math.cos(a) * rr)), Y = fl(V.Y(sy + Math.sin(a) * rr));
            if (X < V.box[0] || X > V.box[2] || Y < Math.max(LB, V.box[1]) || Y > Math.min(H - 1 - LB, V.box[3]) || bay(X, Y) > 1.15 - f) continue;
            P(X, Y, f < 0.35 ? (k % 2 ? 16 : 15) : k % 2 ? 15 : 58);
          }
        }
      }
    }
    ZL[5] = { name: 'sun', draw: c5Draw };
  }

  /* ================================================================ L6 — the galaxy (and the snail's shell)
     A face-on two-armed spiral, core at (−144, −64), its disc about 512 units in radius, so that 1/8 of it fills the snail's
     shell exactly. The sun is the warm star at (−15.25, +9.7), near the origin, on the outer edge of an arm. It turns one full
     turn every 15 s (slowing as the camera leaves the sun), rigidly, so the shell is a slowly turning wheel of stars.
     The galaxy's light is baked once into a texture in its own turning frame (light, arm, dust), sampled smoothly per pixel
     with dithering; stars are a fixed list (they turn with it) plus a finer field that appears as the camera comes in. */
  {
  const GX = -144, GY = -64, GR = 512, LN = 1 / Math.tan(0.30);
  // the field, at rest (rotation 0), relative to the core: [light, arm, dust]
  function c6Field(dx, dy) {
    const r = Math.sqrt(dx * dx + dy * dy) + 1e-6, q = r / GR, th = Math.atan2(dy, dx);
    const ph = 2 * th - Math.log(r / 14 + 1) * LN * 1.6, wob = (vn(th * 2 + 7, q * 7, 1, 6101) - 0.5) * 0.8;
    const c = Math.cos(ph + wob), arm = Math.pow(Math.max(0, c), 2.6) * sstep(0.05, 0.16, q);
    const dust = Math.pow(Math.max(0, Math.cos(ph + wob + 0.62)), 7) * sstep(0.07, 0.2, q) * (1 - sstep(0.6, 0.95, q));
    const bulge = Math.exp(-q * q / 0.0035), bar = Math.exp(-q * q / 0.02) * 0.35, disc = Math.exp(-q * 2.4) * (1 - sstep(0.8, 1.12, q));
    const clump = 0.55 + 0.9 * vn(dx * 0.05, dy * 0.05, 1, 6102) * vn(dx * 0.013, dy * 0.013, 1, 6104);
    const light = bulge * 1.2 + bar + disc * (0.2 + 1.0 * arm * clump) - dust * disc * 0.9;
    return [Math.max(0, light), arm, dust * Math.min(1, disc * 4)];
  }
  // bake: a 720 × 720 grid over ±640 units around the core
  const TN = 720, TS = 1280 / TN, TL = new Float32Array(TN * TN), TA = new Float32Array(TN * TN), TD = new Float32Array(TN * TN);
  let BAKED = false;
  function c6Bake() { BAKED = true; c6Stars(); for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) { const [l, a, d] = c6Field((i + 0.5) * TS - 640, (j + 0.5) * TS - 640), n = j * TN + i; TL[n] = l; TA[n] = a; TD[n] = d; } }
  function c6Sample(A, gx, gy) {
    const fx = (gx + 640) / TS - 0.5, fy = (gy + 640) / TS - 0.5, i = fl(fx), j = fl(fy);
    if (i < 0 || j < 0 || i >= TN - 1 || j >= TN - 1) return 0;
    const ax = fx - i, ay = fy - j, n = j * TN + i;
    return (A[n] * (1 - ax) + A[n + 1] * ax) * (1 - ay) + (A[n + TN] * (1 - ax) + A[n + TN + 1] * ax) * ay;
  }
  // the stars: a fixed list in the galaxy's frame, thickest along the arms
  const STARS = [];
  function c6Stars() { for (let k = 0; STARS.length < 3600 && k < 60000; k++) {
    const q = Math.pow(ih(k, 1, 6110), 0.75) * 1.05, a = ih(k, 2, 6110) * TAU, r = q * GR, dx = Math.cos(a) * r, dy = Math.sin(a) * r, [, arm] = c6Field(dx, dy);
    if (ih(k, 3, 6110) > 0.08 + arm * 0.92 && q > 0.1) continue;
    STARS.push([dx, dy, ih(k, 4, 6110), arm > 0.45 && ih(k, 5, 6110) < 0.1 ? 1 : 0]);
  } }
  const FAR = []; for (let k = 0; k < 10; k++) { const a = ih(k, 6, 6120) * TAU, d = 620 + ih(k, 7, 6120) * 160; FAR.push([GX + Math.cos(a) * d, GY + Math.sin(a) * d, 5 + ih(k, 3, 6120) * 9, ih(k, 4, 6120) * PI, 0.3 + ih(k, 5, 6120) * 0.5]); }
  const RAMP_B = [5, 62, 58, 15, 16, 108, 22], RAMP_A = [4, 5, 7, 47, 147, 148, 22], RAMP_H = [2, 3, 4, 55, 56, 57];
  // one pixel of the galaxy's light (x, y in L6 units; cr, sr its turn; u the scale; mul dims it, toward 0 = black space)
  function c6Pix(x, y, X, Y, cr, sr, u, mul, neb) {
    const dx = x - GX, dy = y - GY, gx = dx * cr + dy * sr, gy = -dx * sr + dy * cr;   // into the galaxy's turning frame
    const L = c6Sample(TL, gx, gy) * mul, b = bay(X, Y) - 0.5;
    let c;
    if (L < 0.05) {
      if (L > 0.012 && b + 0.5 < L * 14) c = 3;
      else { const n = neb ? neb[0] + neb[1] * x + neb[2] * y : vn(x * 0.004, y * 0.004, 1, 6103); c = n > 0.62 && b + 0.5 < (n - 0.62) * 1.5 * mul ? 77 : n > 0.48 && b + 0.5 < (n - 0.48) * 0.5 * mul ? 76 : 0; }
    } else {
      const A = c6Sample(TA, gx, gy), Dd = c6Sample(TD, gx, gy), q = Math.sqrt(gx * gx + gy * gy) / GR, lv = L + b * 0.11;
      if (q < 0.09 + b * 0.02) c = RAMP_B[clamp(fl(lv * 5.2), 0, 6)];
      else if (Dd > 0.3 + b * 0.2 && lv < 0.55) c = Dd > 0.65 ? 1 : 2;
      else if (A > 0.3 + b * 0.25) c = RAMP_A[clamp(fl(lv * 7), 0, 6)];
      else c = RAMP_H[clamp(fl(lv * 9), 0, 5)];
    }
    return c;
  }
  // the finer stars (anchored in the galaxy, turning with it), as the camera comes in: one per cell where it is bright
  // enough. V's units are k to one of L6's (1 here, 8 in L5); u6 is the galaxy's scale; wf(x, y) (V's units) dims them.
  function c6Fine(V, cr, sr, u6, k, wf) {
    if (u6 <= 0.6) return;
    const cs = u6 > 3 ? 3 : 10, Hh = V.hole, xs = [V.lx(V.box[0]) / k, V.lx(V.box[2]) / k], ys = [V.ly(Math.max(LB, V.box[1])) / k, V.ly(Math.min(H - 1 - LB, V.box[3])) / k];
    let g0 = 1e9, g1 = -1e9, h0 = 1e9, h1 = -1e9;
    for (const x of xs) for (const y of ys) { const dx = x - GX, dy = y - GY, gx = dx * cr + dy * sr, gy = -dx * sr + dy * cr; g0 = Math.min(g0, gx); g1 = Math.max(g1, gx); h0 = Math.min(h0, gy); h1 = Math.max(h1, gy); }
    for (let cj = fl(h0 / cs); cj <= fl(h1 / cs); cj++) for (let ci = fl(g0 / cs); ci <= fl(g1 / cs); ci++) {
      const hx = (ci + ih(ci, cj, 6130)) * cs, hy = (cj + ih(ci, cj, 6131)) * cs, x = (GX + hx * cr - hy * sr) * k, y = (GY + hx * sr + hy * cr) * k;
      const X = fl(V.X(x)), Y = fl(V.Y(y)); if (X < V.box[0] || X > V.box[2] || Y < Math.max(LB, V.box[1]) || Y > Math.min(H - 1 - LB, V.box[3])) continue;
      if (Hh && X >= Hh[0] && X <= Hh[2] && Y >= Hh[1] && Y <= Hh[3]) continue;
      const L = c6Sample(TL, hx, hy); if (ih(ci, cj, 6132) >= (0.15 + L * 1.2) * (wf ? wf(x, y) : 1)) continue;
      BUF[Y * W + X] = ih(ci, cj, 6133) < 0.3 ? 22 : L > 0.3 ? 148 : 20;
    }
  }
  // the galaxy's turn: once a loop, but slowing almost to rest as we leave the sun (t ≈ 10.2), quickest in the shell
  const c6Rot = (t) => zP(t, 1) - 0.97 * Math.sin(zP(t, 1) - zP(10.2, 1));
  // lent to L5, whose space is this light seen from inside (fading to black about the sun)
  ZSH.galaxy = { pix: c6Pix, fine: c6Fine, prep(t) { if (!BAKED) c6Bake(); const r = c6Rot(t); return [Math.cos(r), Math.sin(r)]; } };
  // the sun, in L6 units (L5's sun, an eighth the size): its light as L5 draws it, so the window's edge cuts nothing
  const SUN6 = [-122 / 8, 77.6 / 8];
  function c6Draw(V, t) {
    if (!BAKED) c6Bake();
    const rot = c6Rot(t), cr = Math.cos(rot), sr = Math.sin(rot), u = V.u;
    V.each(-720, -720, 720, 720, (x, y, X, Y) => c6Pix(x, y, X, Y, cr, sr, u, 1));
    c6Fine(V, cr, sr, u, 1, null);
    zGlow(V, SUN6[0], SUN6[1], 140 / 8, T_WARM, 0.32); zGlow(V, SUN6[0], SUN6[1], 60 / 8, T_GOLD, 0.45);
    // the glow of the core
    zGlow(V, GX, GY, 70, T_GOLD, 0.45); zGlow(V, GX, GY, 22, T_WH, 0.55);
    // the stars, turning with the galaxy
    const big = u > 0.5;
    for (const [sx0, sy0, m, knot] of STARS) {
      const x = GX + sx0 * cr - sy0 * sr, y = GY + sx0 * sr + sy0 * cr, X = V.X(x), Y = V.Y(y);
      if (X < -3 || X >= W + 3 || Y < -3 || Y >= H + 3) continue;
      if (knot) { const rr = Math.min(2.6, 1.6 * u); if (rr > 1.1) { glow(X, Y, rr * 4, T_MAG, 0.3); discF(X, Y, rr, 73); discF(X, Y, rr * 0.5, 75); } else P(X, Y, u > 0.2 ? 74 : 56); continue; }
      const tw = 0.5 + 0.5 * Math.sin(zP(t, 2 + fl(m * 3)) + sx0);
      const c = m > 0.985 ? 22 : m > 0.92 ? (tw > 0.5 ? 22 : 148) : m > 0.65 ? 21 : m > 0.35 ? 20 : 19;
      P(X, Y, c);
      if (big && m > 0.965) { const Lr = Math.min(4, 1 + u * 0.7); for (let d = 1; d <= Lr; d++) { const cc = d > Lr * 0.6 ? 20 : 21; P(X - d, Y, cc); P(X + d, Y, cc); P(X, Y - d, cc); P(X, Y + d, cc); } }
    }
    // far galaxies, tiny tilted spirals in the dark
    for (const [x, y, r, a, tilt] of FAR) {
      if (!V.vis(x - r, y - r, x + r, y + r) || V.S(r) < 1.5) continue;
      const ca = Math.cos(a + rot * 0.3), sa = Math.sin(a + rot * 0.3);
      V.each(x - r, y - r, x + r, y + r, (px, py, X, Y) => { const dx = px - x, dy = py - y, ux = dx * ca + dy * sa, uy = (-dx * sa + dy * ca) / tilt, d = Math.hypot(ux, uy) / r; if (d > 1) return -1; const sp = Math.cos(Math.atan2(uy, ux) * 2 - Math.log(d * 8 + 0.1) * 2.6), l = (1 - d) * (0.35 + 0.65 * Math.max(0, sp)); return l > 0.7 ? 21 : l > 0.45 ? 57 : l > 0.25 ? 56 : bay(X, Y) < l * 2.5 ? 55 : -1; });
    }
    // the sun: a warm star by the origin (drawn for when L5, inside, is too small to draw it)
    const SX = V.X(SUN6[0]), SY = V.Y(SUN6[1]);
    if (SX > -30 && SX < W + 30 && SY > -30 && SY < H + 30) {
      if (u > 0.2) zGlow(V, SUN6[0], SUN6[1], 5, T_WARM, 0.6);
      P(SX, SY, u > 0.4 ? 22 : 16);
      if (u > 1) { const Lr = Math.min(9, u * 2.2); for (let d = 1; d <= Lr; d++) { const c = d > Lr * 0.5 ? 15 : 16; P(SX - d, SY, c); P(SX + d, SY, c); P(SX, SY - d, c); P(SX, SY + d, c); } }
    }
  }
  ZL[6] = { name: 'galaxy', draw: c6Draw, R: 720 };
  }

  /* ================================================================ Carry: the film is one shot */
  shot(0, ZD, (lt, t) => { zFrame(t); });

  /* ================================================================ captions */
  // [t0, t1, kind, speaker, text, y]; kinds: n narration (top bar), s speech (bottom bar), x shout (centre)

  function drawCaptions(t) {
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
  if (typeof window !== 'undefined') window.__carry_core = { render, BUF, PAL, W, H, D, SHAKE: () => [SHX, SHY] };
  (window.PIECES = window.PIECES || []).push({
    id: 'carry',
    title: 'Carry',
    medium: 'Pixel art, 480 × 270, drawn in JavaScript · a 15 s loop',
    note: 'An endless zoom · tap to pause',
    about: 'A small snail on a flower looks up at the night. The camera pulls back, and back: the meadow, the valley, the coast, the world, the sun and its planets, the galaxy, and the galaxy turns out to be the spiral on the shell of a small snail on a flower, looking up at the night. Fifteen seconds that never end.',
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
        window.__thecarry = {
          duration: D,
          isReady: () => ready && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__thecarry.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-unmaker';
        api.ready();
      } else {
        window.__thecarry = { duration: D, isReady: () => ready, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
        api.ready();
      }
      let hold = 0;
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;                                     // a seamless loop: straight round again
        draw(clock);
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
          if (window.__thecarry) delete window.__thecarry;
        },
      };
    },
  });

})();
