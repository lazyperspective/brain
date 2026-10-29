/* Snow Globe — an endless push in.
 *
 * A snow globe on a cabin table; a village inside it; a toy shop's window; a snow globe on the toymaker's bench; a
 * cabin in the woods inside that, and through its window the table and the globe again. Every frame is a pure
 * function of t, drawn into a 480 × 270 indexed buffer and shown at 4×; the film is one unbroken zoom, a 15 s loop.
 * Built from the parts in fable-saga/production/snowglobe/src.
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
    // Snow Globe
    '0b2018', '133426', '1e4c34', '2e6844', '4a8a5a',                                             // 149-153 pine
    '3a0a12', '62121c', '962028', 'c8383a', 'ee6a5a',                                             // 154-158 Christmas red
    '24140c', '3c2416', '5c3820', '84542e', 'ac7840',                                             // 159-163 wood
    'f2c9a4', 'd69c78', 'a8705a',                                                                 // 164-166 skin
    '5a7aa8', '8aa6cc', 'bcd0ea', 'e6f0ff',                                                       // 167-170 snow at night
    '4a2a36', '6e3e48',                                                                           // 171-172 rug and wallpaper
    '5a4018', '8a6a2a', 'c8a050',                                                                 // 173-175 brass
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
  const T_MAG = mkTab('ff3ac8', true), T_CYAN = mkTab('40d8ff', true);

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

  /* ================================================================ the endless zoom — the kit every layer uses (from Carry)
     The film is one continuous pull-back through seven layers of scale, each ZR = 8 times larger than the one inside it,
     and then it is back where it began (layer 7 is layer 0). Each layer is drawn in its own units: at its nominal size
     (u = 1) one unit is one screen pixel and its origin is the centre of the frame (240, 135). The layer inside it lives at
     its origin, 1/8 the size, and shows through its window (mask). */
  const ZR = 8, ZN = 4, ZD = 15;
  // how far out we are, in layers, at time t: Snow Globe pushes IN, one layer every 3.75 s, easing to a breath as each
  // layer arrives at its own size and diving between. zS(0) = 4 ≡ 0, zS(15) = 0.
  const zS = (t) => 4 - 4 * t / ZD + 0.55 * Math.sin(8 * PI * t / ZD) / (2 * PI);
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
      const [kk, u, clip] = plan[i], L = ZL[zMod(kk)], hb = i + 1 < plan.length && L ? (L.hole || (!L.mask ? ZRECT_HOLE : null)) : null;
      const hole = hb ? [Math.ceil(240 + hb[0] * u - 0.5) + 1, Math.ceil(135 + hb[1] * u - 0.5) + 1, fl(240 + hb[2] * u - 0.5) - 1, fl(135 + hb[3] * u - 0.5) - 1] : null;
      if (i > 0) ZSAVE.set(BUF);
      zDraw(kk, u, t, clip, hole && hole[2] > hole[0] && hole[3] > hole[1] ? hole : null);
      if (i > 0) zWindow(kk + 1, plan[i - 1][1]);
    }
  }
  if (typeof window !== 'undefined') window.__globe = { zS, zP, ZL, zView, zDraw, zFrame, ZR, ZN, ZD };

  /* ================================================================ Snow Globe: the scene kit
     Ramps, a dithered ramp pick, soft light, and snow that falls at every scale. */
  // pick from a ramp (dark → light) at level v ∈ [0, 1], ordered-dithered between neighbours by d = bay(X, Y)
  const rp = (R, v, d) => R[clamp(fl(v * (R.length - 1) + d), 0, R.length - 1)];
  const R_PINE = [0, 149, 150, 151, 152, 153], R_RED = [154, 155, 156, 157, 158], R_WOOD = [27, 159, 160, 161, 162, 163, 31];
  const R_LOG = [159, 160, 161, 162, 163, 31, 15], R_SKIN = [166, 165, 164], R_SNOW = [134, 135, 136, 167, 168, 169, 170, 22];
  const R_STONE = [120, 121, 122, 123, 19], R_BRASS = [173, 174, 175, 16], R_CREAM = [67, 66, 65, 64, 22], R_FIRE = [11, 12, 13, 14, 15, 16, 22];
  const R_NIGHT = [114, 115, 134, 135, 136, 137];
  // a soft light's reach at distance² q from it, radius r: 1 at the light, 0.5 at r, falling off gently
  const lit = (q, r) => 1 / (1 + q / (r * r));
  // a flicker on the loop (n: its speed in turns per loop; k: a seed)
  const flick = (t, k) => 0.82 + 0.1 * Math.sin(zP(t, 23) + k) + 0.06 * Math.sin(zP(t, 37) + k * 2.3) + 0.04 * Math.sin(zP(t, 61) + k * 0.7);

  /* snow falling over a box of units, the same on screen at every zoom (zStars' octave cells): each column of cells
     holds a flake per cell, its 8-cell pattern sliding down `fall` patterns per loop (so the loop closes) and swaying.
     ok(x, y), if given: may a flake be here (behind nothing)? */
  function zSnow(V, t, x0, y0, x1, y1, dens, seed, fall, cols, ok) {
    cols = cols || [136, 167, 168, 169, 170, 22];
    const u = V.u, P0 = Math.sqrt(340 / dens), Yt = Math.max(V.box[1], LB), Yb = Math.min(V.box[3], H - 1 - LB), Hh = V.hole;
    const xa = Math.max(x0, V.lx(V.box[0] - 2)), xb = Math.min(x1, V.lx(V.box[2] + 2)), ya = Math.max(y0, V.ly(Yt - 2)), yb = Math.min(y1, V.ly(Yb + 2));
    if (xb < xa || yb < ya) return;
    for (let k = Math.ceil(Math.log2(P0 / u)); k < 40; k++) {
      const cs = Math.pow(2, k), pc = cs * u; if (cs > 4 * Math.max(x1 - x0, y1 - y0)) break;
      const fade = sstep(P0, 2 * P0, pc), sd = seed + (k + 64) * 17, off = fall * 8 * cs * t / ZD;
      for (let ii = fl(xa / cs) - 1; ii <= fl(xb / cs) + 1; ii++) {
        const sw = cs * 0.32 * Math.sin(zP(t, 1 + (ii & 1)) + ii * 1.7);
        for (let jj = fl((ya - off) / cs) - 1; jj <= fl((yb - off) / cs) + 1; jj++) {
          const jm = ((jj % 8) + 8) % 8, h = ih(ii, jm, sd); if (h > fade) continue;
          const x = (ii + ih(ii, jm, sd + 1)) * cs + sw * (0.6 + 0.8 * ih(ii, jm, sd + 4)), y = (jj + ih(ii, jm, sd + 2) * 0.85) * cs + off;
          if (x < x0 || x > x1 || y < y0 || y > y1 || (ok && !ok(x, y))) continue;
          const X = fl(V.X(x)), Y = fl(V.Y(y)); if (X < V.box[0] || X > V.box[2] || Y < Yt || Y > Yb) continue;
          if (Hh && X >= Hh[0] && X <= Hh[2] && Y >= Hh[1] && Y <= Hh[3]) continue;
          const b = ih(ii, jm, sd + 3) * clamp((fade - h) / 0.35, 0.3, 1), c = cols[clamp(fl(b * cols.length), 0, cols.length - 1)];
          BUF[Y * W + X] = c;
          if (b > 0.88 && X + 1 <= V.box[2] && Y + 1 <= Yb) { BUF[Y * W + X + 1] = c; BUF[(Y + 1) * W + X] = c; BUF[(Y + 1) * W + X + 1] = cols[cols.length - 2]; }
        }
      }
    }
  }
  // a window's glass: a crisp rectangle (its frame is the outer layer's), and where the layer inside covers it whole
  const paneMask = (x, y) => clamp((36 - Math.abs(x)) / 0.8, 0, 1) * clamp((22 - Math.abs(y)) / 0.8, 0, 1), PANE_BOX = [-36, -22, 36, 22], PANE_HOLE = [-35, -21, 35, 21];
  // is (x, y) on the text s set from (x0, y0) (its top left) in the pixel font, sc units to a font pixel?
  function glyphAt(s, x, y, x0, y0, sc) {
    const gy = fl((y - y0) / sc); if (gy < 0 || gy > 6) return false;
    let cx = x0;
    for (let i = 0; i < s.length; i++) { const g = FONT[s[i]] || FONT[' '], gw = g[0].length; if (x >= cx && x < cx + gw * sc) { const gx = fl((x - cx) / sc); return g[gy][gx] === '#'; } cx += (gw + 1) * sc; }
    return false;
  }
  const textW = (s, sc) => { let w = 0; for (const ch of s) w += ((FONT[ch] || FONT[' '])[0].length + 1) * sc; return w - sc; };

  /* ================================================================ L0 — the cabin, inside
     Seen through its own front window (L1). On a little table in a red cloth: the snow globe (the window to L3, the
     village), a candle on the left, a mug of cocoa on the right. Behind: log walls in firelight; the fireplace on the left
     with four stockings on the mantel and a tabby cat asleep on the rug before it; the tree on the right, its lights
     twinkling, presents beneath; a small back window full of falling snow; a garland along the beam. */
  // the globe (shared with L2's): glass of radius 38 about the origin, its brass and wood base from y = 27 down
  const GLOBE_R = 38;
  function globeMask(x, y) {
    if (y > 27) return 0;
    const r = Math.sqrt(x * x + y * y); let m = clamp((GLOBE_R - r) / 2, 0, 1);
    if (m <= 0) return 0;
    if (r > 26 && r < 32 && y < 0) { const a = Math.atan2(y, x); if (a > -2.65 && a < -1.75) m *= 0.45; }   // the long highlight, upper left
    if ((x - 18) * (x - 18) + (y + 20) * (y + 20) < 9) m *= 0.3;        // a small bright spot, upper right
    return m;
  }
  const GLOBE_BOX = [-38, -38, 38, 28], GLOBE_HOLE = [-20, -10, 24, 25];   // (HOLE: a rect the glass covers whole, clear of the highlights)
  // the globe as its outer layer draws it: rim, highlights, glass (the scene inside replaces most of it), base.
  // lx, ly: where its key light is (to the left for both layers); warm: how warm the room's light is
  function globePix(x, y, d, lx) {
    if (y <= 27) {
      const r = Math.sqrt(x * x + y * y);
      if (r < GLOBE_R) {
        if (r > 26 && r < 32 && y < 0) { const a = Math.atan2(y, x); if (a > -2.65 && a < -1.75) return d < 0.5 ? 22 : 170; }
        if ((x - 18) * (x - 18) + (y + 20) * (y + 20) < 9) return 22;
        if (r > GLOBE_R - 2) { const side = (x * lx < 0 ? 0 : 1); return side ? (d < 0.5 ? 146 : 15) : (d < 0.5 ? 137 : 138); }
        return d < 0.3 ? 137 : 136;
      }
    }
    if (y > 27 && y < 49) {
      const hw = 28 + (y - 27) * 0.24; if (Math.abs(x) > hw) return -1;
      const sh = 0.55 - 0.35 * x / hw * Math.sign(lx) * -1;
      if (y < 31) return rp(R_BRASS, clamp(sh + 0.15 + (y < 28.2 ? 0.25 : 0), 0, 1), d);
      if (y > 45.5) return rp(R_BRASS, clamp(sh * 0.8, 0, 1), d);
      return rp(R_WOOD, clamp(sh * 0.75 + 0.05 * Math.sin(x * 0.9 + y * 0.2), 0, 1), d);
    }
    return -1;
  }
  {
    // the tree: [y of a tier's top, its half-width at the bottom, y of its bottom]
    const TX = 168, TIERS = [[-94, 24, -58], [-74, 40, -26], [-48, 56, 12], [-18, 72, 52]];
    const treeHW = (x, y) => { let best = -1; for (const [y0, w, y1] of TIERS) if (y >= y0 && y <= y1) { const f = (y - y0) / (y1 - y0), e = w * f * (1 - 0.12 * (1 + Math.sin((x - TX) * 0.5 + y * 0.3)) * f); best = Math.max(best, e); } return best; };
    const LIGHTS = [], ORN = [];
    for (let k = 0; k < 70; k++) { const f = ih(k, 1, 601), y = -88 + f * 136, hw = Math.max(4, treeHW(TX, y) - 4), x = TX + (ih(k, 2, 601) * 2 - 1) * hw * 0.92; LIGHTS.push([x, y, k % 4, ih(k, 3, 601)]); }
    for (let k = 0; k < 16; k++) { const f = ih(k, 1, 602), y = -80 + f * 125, hw = Math.max(4, treeHW(TX, y) - 7), x = TX + (ih(k, 2, 602) * 2 - 1) * hw * 0.85; ORN.push([x, y, k % 3]); }
    const R_TABBY = [38, 36, 35, 37];
    const LCOL = [[157, 158], [15, 16], [46, 47], [49, 50]], OCOL = [R_RED, R_BRASS, [88, 45, 46, 47]];
    const STOCK = [[-236, 157], [-201, 151], [-166, 157], [-131, 151]];
    const FIRE = [-180, 30], CANDLE = [-87, 0], PRESENTS = [[96, 128, 28, 0, 1], [124, 150, 36, 1, 0], [188, 226, 24, 2, 0], [214, 246, 40, 0, 2]], PRAMP = [R_RED, R_PINE, [88, 45, 46, 47]];
    const star5 = (x, y, r) => { const a = Math.atan2(y, x), q = Math.sqrt(x * x + y * y), k = Math.cos(5 * (a + PI / 2)) * 0.5 + 0.5; return q < r * (0.45 + 0.55 * k * k); };
    function c0Draw(V, t) {
      const fk = flick(t, 1), ck = flick(t, 4.2), br = 1 + 0.03 * Math.sin(zP(t, 4));
      V.each(-330, -210, 330, 210, (x, y, X, Y) => {
        const d = bay(X, Y);
        // the light that reaches here: the fire, the candle, the tree, and a little from the room
        const qf = (x - FIRE[0]) ** 2 + (y - FIRE[1]) ** 2, qc = (x - CANDLE[0]) ** 2 + (y - CANDLE[1]) ** 2, qt = (x - TX) ** 2 + (y + 50) ** 2;
        const Lf = lit(qf, 130) * fk, Lc = lit(qc, 60) * ck, Lt = lit(qt, 80) * 0.5, Lm = 0.07 + Lf * 0.55 + Lc * 0.22 + Lt * 0.3;
        if (x > -39 && x < 39 && y > -39 && y < 49) { const g = globePix(x, y, d, -1); if (g >= 0) return g; }
        // the candle: flame, wax, holder
        if (x > -97 && x < -77 && y > -12 && y < 46) { const fx = x - CANDLE[0], fy = y - CANDLE[1], sway = 0.8 * Math.sin(zP(t, 11)) * (fy < 0 ? -fy / 9 : 0);
          if (fy > -10 && fy < 6) { const w = fy < 0 ? 2.6 * Math.sqrt(1 + fy / 10) : 2.6 * Math.sqrt(Math.max(0, 1 - fy / 6)); if (Math.abs(fx - sway) < w) return Math.abs(fx - sway) < w * 0.45 && fy > -6 ? 22 : fy > 3 ? 14 : 16; }
          if (Math.abs(fx) < 5 && fy >= 6 && fy < 40) return rp(R_CREAM, clamp(0.85 - 0.08 * (fy - 6) / 34 + (fx < 0 ? 0.1 : -0.2), 0, 1), d);
          if (Math.abs(fx) < 9 - (fy - 40) * 0.2 && fy >= 40 && fy < 46) return rp(R_BRASS, fx < 0 ? 0.8 : 0.4, d); }
        // the mug of cocoa, its snowflake band, its handle
        if (x > 58 && x < 92 && y > 22 && y < 46) { const mx = x - 71;
          if (Math.abs(mx) < 11 && y >= 25 && y < 46) { const s = 0.55 - mx / 22; if (y < 27) return 28; if (y > 31 && y < 36) return (Math.abs(((mx + 22) % 6) - 3) < 1 && y > 32 && y < 35) ? 157 : rp(R_CREAM, clamp(s + 0.1, 0, 1), d); return rp(R_RED, clamp(s + 0.15, 0, 1), d); }
          const hx = x - 85, hy = y - 35, hq = hx * hx + hy * hy; if (x > 81 && hq < 34 && hq > 10) return 156; }
        // the table in its red cloth (gold trim along the edge), the floor beyond
        { const ty = y - 48;
          if (ty > -3 && ty < 3 && Math.abs(x) < 150) return rp(R_RED, clamp(0.45 + Lm * 0.5 - (ty + 3) * 0.05, 0, 1), d);
          if (ty >= 3 && Math.abs(x) < 150 + ty * 0.16) { const fold = 0.5 + 0.28 * Math.sin(x * 0.11 + Math.sin(x * 0.03) * 2) * Math.min(1, ty / 30); if (Math.abs(ty - 5) < 1.2) return d < 0.5 ? 175 : 174; return rp(R_RED, clamp(fold * (0.4 + Lm * 0.7) - ty * 0.002, 0, 1), d); } }
        // the cat asleep on the rug
        if (x > -235 && x < -160 && y > 60 && y < 98) { const ox = -25, cx = x + 180 - ox, cy = y - 80, bq = (cx / 24) ** 2 + (cy / (10 * br)) ** 2, hq = (x + 157 - ox) ** 2 + (y - 78) ** 2, ex = x - ox;
          const ear = (y < 71 && y > 65 && ((ex > -163 && ex < -158 && y > 65 + (ex + 163) * 1.1) || (ex > -156 && ex < -151 && y > 65 + (-151 - ex) * 1.1)));
          const tail = Math.abs(Math.hypot(ex + 180, y - 82) - 22) < 2.4 && y > 82 && ex < -170 + 4 * Math.sin(zP(t, 2));
          if (bq < 1 || hq < 64 || ear || tail) { const stripe = Math.sin((ex + 180) * 0.55) > 0.55 && hq >= 64 ? -0.25 : 0, s = 0.35 + Lf * 0.6 - (y - 74) * 0.02 + stripe;
            if (hq < 64 && Math.abs(y - 79) < 0.6 && (Math.abs(ex + 160) < 2 || Math.abs(ex + 154) < 2)) return 38;   // closed eyes
            return rp(R_TABBY, clamp(s, 0, 1), d); } }
        // the rug
        { const rq = ((x + 200) / 70) ** 2 + ((y - 94) / 15) ** 2; if (rq < 1) { const ring = fl(Math.sqrt(rq) * 4); return ring === 3 ? rp(R_BRASS, 0.3 + Lf * 0.4, d) : ring % 2 ? rp(R_PINE, 0.3 + Lf * 0.5, d) : rp(R_RED, 0.2 + Lf * 0.6, d); } }
        // the presents beneath the tree
        if (y >= 24 && y < 60 && x >= 96) for (const [bx0, bx1, by0, c0, c1] of PRESENTS) {
          if (x >= bx0 && x < bx1 && y >= by0 && y < 60) { const mx = (bx0 + bx1) / 2, rib = Math.abs(x - mx) < 2 || Math.abs(y - (by0 + 60) / 2) < 2, s = 0.3 + Lt * 0.8 + Lf * 0.2 + (x < mx ? 0.1 : -0.05);
            return rib ? rp(R_BRASS, clamp(s + 0.2, 0, 1), d) : rp(PRAMP[c0], clamp(s, 0, 1), d); }
        }
        // the tree and its star
        if (x > TX - 76 && x < TX + 76 && y > -110 && y < 63) { if (star5(x - TX, y + 100, 8)) return d < 0.6 ? 16 : 59;
          const hw = treeHW(x, y); if (hw >= 0 && Math.abs(x - TX) < hw) { const n = vn(x * 0.35, y * 0.35, 1, 603), e = (x - TX) / hw; return rp(R_PINE, clamp(0.25 + n * 0.35 - e * 0.18 + Lf * 0.25 + Lt * 0.35, 0, 1), d); }
          if (x > TX - 6 && x < TX + 6 && y > 50 && y < 62) return rp(R_WOOD, 0.3, d); }
        // the stockings on the mantel
        if (x > -245 && x < -114 && y > -52 && y < -18) for (const [sx, sc] of STOCK) {
          const fx = x - sx; if (y < -52 || y > -18 || fx < -8 || fx > 15) continue;
          if (y < -45 && Math.abs(fx) < 8) return rp(R_CREAM, 0.6 + Lf * 0.3, d);
          if ((Math.abs(fx) < 7 && y < -26) || (fx > -7 && fx < 14 && y >= -26 && Math.hypot(Math.max(0, fx - 8), y + 22) < 5)) return rp(sc === 157 ? R_RED : R_PINE, clamp(0.3 + Lf * 0.6 - fx * 0.01, 0, 1), d);
        }
        // the mantel, the fireplace and its fire
        if (x > -262 && x < -98 && y > -60 && y < -52) return rp(R_WOOD, clamp(0.35 + Lf * 0.45 + (y < -58 ? 0.2 : 0), 0, 1), d);
        if (x > -250 && x < -110 && y >= -52 && y < 60) {
          if (x > -212 && x < -148 && y > -6) {
            const h = 52 - y, cxp = x + 180;
            if (h < 8 && Math.abs(cxp) < 26 && ((h > 2 && h < 7) || Math.abs(cxp - 10) < 9 && h < 4)) return rp(R_WOOD, 0.3 + 0.2 * Math.sin(cxp), d);
            let I = h < 9 ? Math.max(0, 0.55 - Math.abs(cxp) / 40) * (h < 4 ? 1 : 0.6) : 0;          // embers under the logs
            for (let k = 0; k < 5; k++) {
              const H0 = [22, 32, 40, 31, 21][k] * (0.82 + 0.18 * Math.sin(zP(t, 7 + k * 2) + k)), x0 = [-17, -8, 0, 9, 18][k] + h * 0.09 * Math.sin(h * 0.14 - zP(t, 9 + k) + k);
              if (h > H0 || h < 2) continue;
              const hw = [7, 8, 9, 8, 7][k] * Math.sqrt(1 - h / H0) * (1 + 0.25 * Math.sin(h * 0.35 - zP(t, 13) + k * 2)), e = 1 - Math.abs(cxp - x0) / hw;
              if (e > 0) I = Math.max(I, e * 0.55 + (1 - h / H0) * 0.5);
            }
            if (I > 0.06) return rp(R_FIRE, clamp(I, 0, 1), d);
            return d < 0.2 + Lf * 0.1 ? 28 : 27;
          }
          const sx = Math.floor((x + 250) / 15 + (Math.floor((y + 52) / 10) % 2) * 0.5), sy = Math.floor((y + 52) / 10), mortar = ((x + 250 + (sy % 2) * 7.5) % 15 < 1.2) || ((y + 52) % 10 < 1.2);
          return mortar ? 120 : rp(R_STONE, clamp(0.1 + Lf * 0.7 + ih(sx, sy, 604) * 0.2, 0, 1), d);
        }
        // the back window: frame, cross bars, the snowy night outside
        if (x > -54 && x < 54 && y > -104 && y < -44) {
          if (x < -49 || x > 49 || y < -99 || y > -49 || Math.abs(x) < 2 || Math.abs(y + 74) < 2) return rp(R_WOOD, clamp(0.25 + Lm * 0.5, 0, 1), d);
          const frost = Math.max(0, 0.9 - Math.min(Math.abs(x) - 30, 0) * 0) ;
          if (y > -62 + 4 * Math.sin(x * 0.07)) return rp(R_SNOW, 0.45 + 0.1 * Math.sin(x * 0.2), d);
          const tree = Math.abs(x - 30) < (y + 90) * 0.38 && y > -90, tree2 = Math.abs(x + 34) < (y + 84) * 0.32 && y > -84;
          if (tree || tree2) return d < 0.4 ? 150 : 149;
          return rp(R_NIGHT, 0.35 + (y + 104) / 150, d);
        }
        // the beam and its garland
        if (y < -106) { if (y > -114) { const gw = Math.sin(x * 0.12) * 2; if (Math.abs(y + 108 - gw) < 3.5) return rp(R_PINE, 0.3 + Lm * 0.5, d); } return rp(R_WOOD, clamp(0.08 + Lm * 0.4 + (y > -118 ? 0.1 : 0), 0, 1), d); }
        // the floor
        if (y > 58) { const plank = Math.floor((x + 1000) / 26), s = 0.22 + Lm * 0.6 + ih(plank, 1, 605) * 0.1; return ((x + 1000) % 26) < 1 ? 159 : rp(R_WOOD, clamp(s, 0, 1), d); }
        // the log walls: rounded logs with pale chinking between, each its own tone
        { const yy = y + 1300, n = Math.floor(yy / 13), v = (yy - n * 13) / 13; if (v < 0.1) return d < 0.5 ? 121 : 122;
          const round = Math.sin((v - 0.1) / 0.9 * PI), grain = vn(x * 0.03, n * 3.1, 1, 606) * 0.12 + ih(n, 2, 607) * 0.08;
          return rp(R_LOG, clamp(Lm * (0.35 + 0.65 * round) + grain - 0.06, 0, 1), d); }
      });
      // the tree's lights (twinkling) and its ornaments
      for (const [x, y, k, ph] of LIGHTS) { const on = 0.5 + 0.5 * Math.sin(zP(t, 2 + (k % 3)) + ph * 9), X = fl(V.X(x)), Y = fl(V.Y(y)); if (V.u < 0.5) { P(X, Y, LCOL[k][on > 0.5 ? 1 : 0]); continue; } zDisc(V, x, y, 1.3, LCOL[k][on > 0.5 ? 1 : 0]); if (on > 0.7 && V.u > 0.8) zGlow(V, x, y, 5, k === 1 ? T_GOLD : k === 0 ? T_RED : k === 2 ? T_BL : T_GR, 0.25); }
      for (const [x, y, k] of ORN) { if (V.u < 0.4) continue; V.each(x - 3.5, y - 3.5, x + 3.5, y + 3.5, (px, py, X, Y) => { const q = (px - x) ** 2 + (py - y) ** 2; if (q > 12) return -1; const s = 0.65 - (px - x) * 0.1 - (py - y) * 0.1; return q < 1.5 && px < x ? 22 : rp(OCOL[k], clamp(s, 0, 1), bay(X, Y)); }); }
      // snow outside the back window
      zSnow(V, t, -49, -99, 49, -49, 9, 611, 1, [137, 168, 169, 170], (x, y) => Math.abs(x) > 2 && Math.abs(y + 74) > 2);
      // the cocoa's steam
      V.each(56, -26, 90, 25, (x, y, X, Y) => { let I = 0; for (let k = 0; k < 2; k++) { const xc = 67 + 7 * k + 3 * Math.sin(y * 0.18 + zP(t, 2) + k * 2) + (24 - y) * 0.06, w = 1.3 + (24 - y) * 0.06, e = 1 - Math.abs(x - xc) / w; if (e > 0) I = Math.max(I, e * sstep(-26, 8, y) * sstep(25, 18, y) * (0.55 + 0.45 * Math.sin(y * 0.32 + zP(t, 8) + k * 3))); } return bay(X, Y) < I * 0.5 ? (I > 0.6 ? 20 : 19) : -1; });
      // glows: the fire, the candle, the star
      zGlow(V, FIRE[0], 20, 120, T_WARM, 0.35 * fk); zGlow(V, CANDLE[0], CANDLE[1], 34, T_WARM, 0.45 * ck); zGlow(V, CANDLE[0], CANDLE[1] - 2, 9, T_GOLD, 0.5);
      zGlow(V, TX, -100, 20, T_GOLD, 0.4 + 0.1 * Math.sin(zP(t, 3)));
      // the garland's lights along the beam
      for (let k = -14; k <= 14; k++) { const x = k * 22 + 6, y = -108 + Math.sin(x * 0.12) * 2, on = 0.5 + 0.5 * Math.sin(zP(t, 3) + k * 1.9); zDisc(V, x, y, 1.2, on > 0.5 ? 16 : 15); }
    }
    ZL[0] = { name: 'cabin', draw: c0Draw, mask: globeMask, maskBox: GLOBE_BOX, hole: GLOBE_HOLE };
  }

  /* ================================================================ L1 — the cabin in the woods, inside the workshop's globe
     A log cabin in a clearing of snowy pines under the northern lights. Its roof heavy with snow, icicles along the eave,
     a stone chimney smoking, green shutters with heart cut-outs either side of its lit window (the window to L0, the cabin's
     own room), a wreath on the door, a lantern, a woodpile. A deer grazes by the trees on the right. Snow falls. */
  {
    // pines: [x of the trunk, y of the ground, height, half-width]
    const PINES = [[-320, 40, 200, 56], [-262, 50, 170, 46], [-214, 58, 150, 40], [-176, 46, 116, 30], [190, 46, 120, 32], [236, 56, 160, 42], [292, 44, 196, 54], [350, 40, 170, 46],
      [-372, 30, 150, 40], [-140, 20, 70, 18], [150, 22, 74, 19]];
    const pineAt = (x, y, p) => { const px = p[0], gy = p[1], h = p[2], w = p[3], top = gy - h, f = (y - top) / h; if (f < 0 || f > 1.06) return null; if (f > 1) return Math.abs(x - px) < w * 0.09 ? 'trunk' : null;
      const tier = (f * 5) % 1, hw = w * (0.12 + 0.88 * f) * (0.55 + 0.45 * tier); if (Math.abs(x - px) > hw) return null; return tier < 0.28 && f > 0.05 ? 'snow' : 'needle'; };
    // per column, once a frame: the aurora's fold, foot and strength; the ground's and the far forest's lines
    const CF = new Float32Array(W), CB = new Float32Array(W), CE = new Float32Array(W), CG = new Float32Array(W), CL = new Float32Array(W);
    function c1Draw(V, t) {
      const lk = flick(t, 3.3), a1 = zP(t, 1), a2 = zP(t, 2), graze = 0.5 + 0.5 * Math.sin(zP(t, 2) - 0.6);
      for (let X = 0; X < W; X++) { const x = V.lx(X); CF[X] = x + 26 * Math.sin(x / 95 + a1) + 9 * Math.sin(x / 29 - a2); CB[X] = -92 + 8 * Math.sin(x / 80 + a1) - 4 * Math.sin(x / 26 + a2); CE[X] = 0.55 + 0.45 * Math.sin(x / 130 + 0.6 + a1 * 0.5); CG[X] = 50 + 4 * Math.sin(x * 0.02) + 2 * Math.sin(x * 0.09); CL[X] = -20 + 8 * Math.sin(x * 0.015) + 6 * Math.sin(x * 0.043); }
      V.each(-380, -300, 380, 300, (x, y, X, Y) => {
        const d = bay(X, Y), Lw = lit(x * x + (y - 30) ** 2, 70) * 0.75, Ll = lit((x - 70) ** 2 + (y + 20) ** 2, 30) * lk;
        // the deer, grazing (head down, then up to look)
        if (x > 180 && x < 228 && y > 44 && y < 92) { const bx = x - 206, by = y - 70, body = (bx / 15) ** 2 + (by / 7.5) ** 2 < 1, leg = by > 3 && by < 20 && (Math.abs(bx + 10 - (by - 3) * 0.08) < 1.4 || Math.abs(bx + 6 + (by - 3) * 0.08) < 1.4 || Math.abs(bx - 8 - (by - 3) * 0.06) < 1.4 || Math.abs(bx - 12 + (by - 3) * 0.06) < 1.4);
          const hy = -12 + graze * 20, hx = -19 + graze * 3, neck = Math.abs(((bx + 8) * (hy + 2) - (by + 2) * (hx + 8))) / Math.hypot(hx + 8, hy + 2) < 3 && bx < -6 && bx > hx - 1 && by < Math.max(hy, -2) + 4 && by > Math.min(hy, -2) - 3;
          const head = ((bx - hx) / 4.5) ** 2 + ((by - hy) / 3) ** 2 < 1, ant = (Math.abs(bx - hx - 1 - (by - hy + 4) * 0.4) < 0.6 && by < hy - 2 && by > hy - 10) || (Math.abs(by - hy + 7 - (bx - hx) * 0.3) < 0.6 && bx > hx && bx < hx + 5), tail = ((bx - 15) / 2.5) ** 2 + ((by + 3) / 2) ** 2 < 1;
          if (ant) return rp(R_WOOD, 0.35, d); if (tail) return 170;
          if (body || leg || neck || head) return (head && Math.abs(bx - hx + 2) < 0.7 && Math.abs(by - hy + 0.5) < 0.7) ? 0 : rp(R_WOOD, clamp(0.25 + (by < -2 ? 0.15 : 0) - bx * 0.004 + (leg ? -0.1 : 0), 0, 1), d); }
        // the near pines
        if (Math.abs(x) > 120) for (let i = 0; i < 9; i++) { const p = PINES[i]; if (Math.abs(x - p[0]) > p[3]) continue; const k = pineAt(x, y, p); if (k) return k === 'trunk' ? rp(R_WOOD, 0.15, d) : k === 'snow' ? rp(R_SNOW, clamp(0.55 + (x < p[0] ? 0.15 : -0.05), 0, 1), d) : rp(R_PINE, clamp(0.12 + (x < p[0] ? 0.14 : 0) + 0.1 * vn(x * 0.3, y * 0.3, 1, 901), 0, 1), d); }
        // the cabin: window, shutters, door, lantern, woodpile, logs, roof and its snow, icicles, chimney
        if (Math.abs(x) < 41 && Math.abs(y) < 27) {
          if (Math.abs(x) < 36 && Math.abs(y) < 22) return rp(R_FIRE, 0.5 + 0.2 * Math.sin(x * 0.17) * Math.sin(y * 0.23), d);
          if (y < -22) return rp(R_SNOW, 0.85, d);
          return rp(R_WOOD, clamp(0.3 + Lw * 0.4, 0, 1), d);
        }
        if (Math.abs(x) < 44 && y >= 27 && y < 32) return y < 29.5 + 0.8 * Math.sin(x * 0.6) ? rp(R_SNOW, 0.9, d) : rp(R_WOOD, 0.25, d);
        if (Math.abs(x) >= 42 && Math.abs(x) < 62 && Math.abs(y) < 27) { const sgn = x < 0 ? -1 : 1, sx = x * sgn; if (sx >= 42 && sx < 62 && Math.abs(y) < 27) { const hx = sx - 52, hy = y + 10, heart = (hx * hx + hy * hy - 5) ** 3 - hx * hx * hy * hy * hy < 0 && false; const hq = Math.abs(hx) < 3.5 && hy > -3 && hy < 3 && (Math.abs(hx) < 3 - Math.max(0, hy) * 0.9);
          if (hq || (Math.hypot(Math.abs(hx) - 1.6, hy + 2) < 1.8)) return rp(R_FIRE, 0.4, d); if (Math.abs(y) > 25.5 || (sx > 49.5 && sx < 50.5) || (sx > 59.5)) return rp(R_PINE, 0.2, d); return rp(R_PINE, clamp(0.32 + Lw * 0.3 + (sgn < 0 ? 0.06 : 0), 0, 1), d); } }
        if (x > 82 && x < 114 && y > -26 && y < 56) {
          const wq = (x - 98) ** 2 + (y + 6) ** 2; if (wq < 70 && wq > 24) return (y > 0 && y < 6 && Math.abs(x - 98) < 4) ? rp(R_RED, 0.75, d) : rp(R_PINE, 0.4 + (x < 98 ? 0.2 : 0) + Ll * 0.3, d);
          if (Math.abs(x - 108) < 1.5 && Math.abs(y - 22) < 2) return rp(R_BRASS, 0.8, d);
          return ((x - 82) % 8 < 0.8) ? 159 : rp(R_WOOD, clamp(0.2 + Ll * 0.45 + ih(fl((x - 82) / 8), 1, 902) * 0.06, 0, 1), d);
        }
        if (Math.abs(x - 72) < 3.5 && y > -24 && y < -12) return Math.abs(x - 72) < 2.2 && y > -22 && y < -14 ? rp(R_FIRE, 0.7 + 0.2 * lk, d) : 40;
        if (Math.abs(x - 72) < 0.6 && y >= -30 && y <= -24) return 40;
        if (x > -146 && x < -98 && y > 24 && y < 56) { if (y < 28 + 1.5 * Math.sin(x * 0.4)) return rp(R_SNOW, 0.8, d); const cx = ((x + 146) % 8) - 4, cy = ((y - 24) % 8) - 4, r = Math.hypot(cx, cy); return r < 3.4 ? (r < 1.2 ? rp(R_WOOD, 0.6, d) : rp(R_WOOD, 0.45 - r * 0.05, d)) : 159; }
        const ridge = -140 + Math.abs(x) * (92 / 175);
        if (x > -86 && x < -62 && y > -150 && y < ridge + 6) { if (y < -146) return rp(R_SNOW, 0.85, d); const st = ih(fl((x + 86) / 6 + (fl((y + 150) / 5) % 2) * 0.5), fl((y + 150) / 5), 903); return ((x + 86 + (fl((y + 150) / 5) % 2) * 3) % 6 < 0.8 || (y + 150) % 5 < 0.8) ? 120 : rp(R_STONE, 0.2 + st * 0.25, d); }
        if (y > ridge - 10 && y < -40 && Math.abs(x) < 178) {
          const eave = -44 + 2 * Math.sin(x * 0.07) + 1.2 * Math.sin(x * 0.31);
          if (y < eave) { const top = y < ridge; return rp(R_SNOW, clamp(0.62 + (x < 0 ? 0.12 : -0.04) - (top ? 0 : 0) + 0.05 * Math.sin(x * 0.25 + y * 0.1) - Math.max(0, y - eave + 4) * 0.08, 0, 1), d); }
          return 1;
        }
        { const ix = fl((x + 400) / 5), il = 2 + 7 * ih(ix, 1, 904); if (Math.abs(x) < 170 && y >= -40 && y < -40 + il && Math.abs(((x + 400) % 5) - 2.5) < 1.3 * (1 - (y + 40) / il)) return d < 0.5 ? 170 : 147; }
        if (Math.abs(x) < 150 && y >= -48 && y < 56) {
          const yy = y + 1300, n = Math.floor(yy / 11), v = (yy - n * 11) / 11; if (v < 0.1) return d < 0.5 ? 121 : 120;
          if (Math.abs(x) > 144) { const r = Math.hypot(Math.abs(x) - 147, v * 11 - 5.5); return r < 4.6 ? (Math.abs(r - 2.5) < 0.6 ? rp(R_WOOD, 0.3, d) : rp(R_WOOD, 0.55, d)) : rp(R_SNOW, 0.7, d); }
          const round = Math.sin((v - 0.1) / 0.9 * PI); return rp(R_LOG, clamp(0.05 + (0.18 + Lw * 0.45 + Ll * 0.3) * (0.4 + 0.6 * round) + vn(x * 0.03, n * 3.3, 1, 905) * 0.08, 0, 1), d);
        }
        // the far pines, the snow, the sky and its aurora
        for (let i = 9; i < PINES.length; i++) { const p = PINES[i], k = pineAt(x, y, p); if (k) return k === 'snow' ? rp(R_SNOW, 0.45, d) : rp(R_PINE, 0.1, d); }
        if (y >= CG[X]) {
          const path = Math.abs(x - 98 - (y - 56) * 0.6) < 10 + (y - 56) * 0.15 && y < 140;
          return rp(R_SNOW, clamp(0.4 + 0.08 * vn(x * 0.05, y * 0.1, 1, 906) + Lw * 0.4 + Ll * 0.25 - (path ? 0.1 : 0) - Math.max(0, y - 140) * 0.0015, 0, 1), d);
        }
        if (y > CL[X]) return rp(R_PINE, 0.08, d);       // the far forest's dark line
        let c = rp(R_NIGHT, clamp(0.7 + y / 300, 0, 1), d);
        const hg = CB[X] - y;
        if (hg > 0 && hg < 140) { const I = CE[X] * zAur(CF[X], hg) * (hg < 2.5 ? hg / 2.5 : 1);
          if (I > 0.62 + d * 0.25) c = hg < 10 ? 49 : hg < 30 ? 48 : 126; else if (I > 0.4 + d * 0.25) c = hg < 14 ? 48 : hg < 40 ? 126 : 125; else if (I > 0.22 + d * 0.22) c = hg < 20 ? 125 : 117; else if (I > 0.1 + d * 0.18) c = hg < 26 ? 124 : 116; }
        return c;
      });
      zStars(V, t, -380, -300, 380, -30, 4, 907, [135, 136, 168, 169, 22], (x, y) => y < -110 + 6 * Math.sin(x * 0.05) && !(y > -150 && Math.abs(x) < 180));
      for (let j = 0; j < 22; j++) { const ph = frac(j / 22 + t / 3.75), y = -150 - ph * 70, x = -74 - ph * 20 + 4 * Math.sin(ph * 5 + zP(t, 1)), r = 2 + ph * 6; if (V.vis(x - r, y - r, x + r, y + r)) V.each(x - r, y - r, x + r, y + r, (px, py, X, Y) => (px - x) ** 2 + (py - y) ** 2 < r * r && bay(X, Y) < (1 - ph) * 0.4 ? 18 : -1); }
      zGlow(V, 0, 28, 64, T_WARM, 0.3); zGlow(V, 72, -18, 16, T_WARM, 0.45 * lk);
      zSnow(V, t, -380, -300, 380, 300, 8, 908, 2);
    }
    ZL[1] = { name: 'forest', draw: c1Draw, mask: paneMask, maskBox: PANE_BOX, hole: PANE_HOLE };
  }

  /* ================================================================ L2 — the toymaker's workshop, through the shop window
     Warm under a green-shaded lamp. On the workbench: the snow globe (the window to L1, the cabin in the woods), a paint
     pot, a hammer, curls of shavings. On the right the old toymaker, white-bearded, spectacles on, painting a wooden
     soldier, brush going up and down. On the left, shelves of toys (a teddy, a drum, soldiers, blocks, a ball, a top, a
     doll, a train that runs along the top shelf). A frosty window behind him, snow falling outside. */
  {
    const LAMP = [0, -86], CURLS = [[40, 44], [56, 45], [-42, 45], [148, 44]], BLOCKS = [[-6, 0, 'A', R_RED], [6, 0, 'B', [88, 45, 46, 47]], [0, -11, 'C', R_PINE]], R_DOLL = [171, 172, 158, 37], R_BLUE = [88, 45, 46, 47], R_IRON = [32, 33, 34, 22];
    const segD = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, w = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1), dx = px - ax - vx * w, dy = py - ay - vy * w; return Math.sqrt(dx * dx + dy * dy); };
    // toys: [kind, x of its bottom centre, y of the shelf it sits on]
    const SH = [-72, -34, 4], TOYS = [
      ['teddy', -222, -34], ['drum', -192, -34], ['soldier', -168, -34], ['soldier', -158, -34], ['ball', -134, -34], ['top', -108, -34], ['doll', -82, -34],
      ['blocks', -224, 4], ['horse', -184, 4], ['jack', -142, 4], ['teddy', -112, 4], ['drum', -84, 4],
      ['soldier', 92, 46]];
    const S_ = (k, v) => clamp(v * k, 0, 1);
    function toyPix(k, x, y, d, L) {
      // x, y: from the toy's bottom centre (y up is negative)
      const sk = 0.45 + L * 0.7;
      switch (k) {
        case 'teddy': { const hq = x * x + (y + 19) ** 2, bq = (x / 7) ** 2 + ((y + 7) / 7.5) ** 2, eq = Math.min((x + 4.5) ** 2 + (y + 24) ** 2, (x - 4.5) ** 2 + (y + 24) ** 2);
          if (hq < 2.2 && y > -18.5) return 27; if (Math.abs(y + 20.5) < 0.7 && (Math.abs(x + 2) < 0.7 || Math.abs(x - 2) < 0.7)) return 0;
          if (hq < 30 || bq < 1 || eq < 6.5) return rp(R_WOOD, S_(sk, 0.75 - x * 0.03 - (eq < 6.5 && eq > 2 ? 0 : 0)), d); return -1; }
        case 'drum': { if (Math.abs(x) > 8 || y < -13 || y > 0) return -1; if (y < -11) return rp(R_CREAM, S_(sk, 0.9), d); if (y > -2.5 || y < -9.5) return rp(R_BRASS, S_(sk, 0.8), d);
          return Math.abs(((x + 20) % 6) - 3) < 0.9 + Math.abs(y + 6) * 0.0 && Math.abs(Math.abs(((x + 20) % 6) - 3) - Math.abs(y + 6) * 0.8) < 0.9 ? rp(R_BRASS, S_(sk, 0.9), d) : rp(R_RED, S_(sk, 0.7 - x * 0.04), d); }
        case 'soldier': { if (Math.abs(x) > 3.2 || y < -25 || y > 0) return -1; if (y < -19) return Math.abs(x) < 2.6 ? 39 : -1; if (y < -15.5) return Math.abs(x) < 2 ? rp(R_SKIN, S_(sk, 0.9), d) : -1;
          if (y < -8) return Math.abs(x) < 0.6 && y > -14 ? rp(R_BRASS, S_(sk, 1), d) : rp(R_RED, S_(sk, 0.75 - x * 0.06), d); if (y < -1) return Math.abs(x) < 0.5 ? -1 : rp(R_BLUE, S_(sk, 0.6), d); return 39; }
        case 'ball': { const q = x * x + (y + 6.5) ** 2; if (q > 42) return -1; const b = fl((y + 13 + x * 0.3) / 3.3); return q < 3 && x < 0 && y < -8 ? 22 : rp((((b % 3) + 3) % 3) === 0 ? R_RED : (((b % 3) + 3) % 3) === 1 ? R_CREAM : R_BLUE, S_(sk, 0.8 - x * 0.05 - (y + 6.5) * 0.04), d); }
        case 'top': { const yy = -y; if (yy < 0 || yy > 13) return -1; const hw = yy < 2 ? yy * 1.2 : yy < 9 ? 2.4 + (yy - 2) * 0.75 : yy < 11 ? 7.6 - (yy - 9) * 2.5 : 1.2; if (Math.abs(x) > hw) return -1; return yy > 11 ? 28 : rp(fl(yy / 2.4) % 2 ? R_RED : R_BRASS, S_(sk, 0.8 - x * 0.06), d); }
        case 'doll': { const hq = x * x + (y + 19) ** 2; if (hq < 16) { if (y < -20.5 || Math.abs(x) > 3) return rp(R_BRASS, S_(sk, 0.9), d); if (Math.abs(y + 19) < 0.6 && Math.abs(Math.abs(x) - 1.5) < 0.6) return 0; return rp(R_SKIN, S_(sk, 0.95), d); }
          const yy = -y; if (yy < 15 && yy > 0 && Math.abs(x) < 1.5 + (15 - yy) * 0.33) return rp(R_DOLL, S_(sk, 0.7 - x * 0.05), d); return -1; }
        case 'blocks': { for (let bi = 0; bi < 3; bi++) { const bx = BLOCKS[bi][0], by = BLOCKS[bi][1], ch = BLOCKS[bi][2], c = BLOCKS[bi][3]; const lx = x - bx, ly = y - by; if (Math.abs(lx) < 5.5 && ly > -11 && ly <= 0) { if (glyphAt(ch, lx, ly, -2.5, -9.5, 1.15)) return rp(R_CREAM, S_(sk, 1), d); return rp(c, S_(sk, 0.7 - lx * 0.04), d); } } return -1; }
        case 'horse': { const leg = (y > -6 && y <= 0 && (Math.abs(x + 7) < 1.3 || Math.abs(x - 6) < 1.3)), rock = y > -1.5 && y <= 0 && Math.abs(x) < 12 + y * 0.5 && Math.abs(Math.sqrt(x * x + (y - 30) ** 2) - 31) < 1.2;
          const body = ((x + 0.5) / 9) ** 2 + ((y + 9) / 4.2) ** 2 < 1, neck = segD(x, y, 6, -10, 10, -19) < 2.6, head = ((x - 12.5) / 3.6) ** 2 + ((y + 19) / 2.4) ** 2 < 1, tail = segD(x, y, -9, -10, -13, -5) < 1;
          if (rock) return rp(R_RED, S_(sk, 0.6), d); if (neck && x < 9 && y < -14 && Math.abs(x - 7.5) < 1) return rp(R_BRASS, S_(sk, 0.7), d);
          if (body || neck || head || leg) return (Math.abs(x - 12) < 0.6 && Math.abs(y + 19.8) < 0.6) ? 0 : rp(R_CREAM, S_(sk, 0.75 - x * 0.02), d); if (tail) return rp(R_BRASS, S_(sk, 0.6), d); return -1; }
        case 'jack': { if (Math.abs(x) < 7 && y > -12 && y <= 0) return (Math.abs(x) < 1 || Math.abs(y + 6) < 1) ? rp(R_BRASS, S_(sk, 0.8), d) : rp(R_BLUE, S_(sk, 0.6 - x * 0.05), d);
          const bob = 1.5 * Math.sin(0); if (y > -18 && y <= -12 && Math.abs(Math.abs(x) - (y + 15) * 0.9) < 1.1) return 34; const hq = x * x + (y + 22 + bob) ** 2; if (hq < 16) return (Math.abs(y + 22.6) < 0.7 && Math.abs(Math.abs(x) - 1.6) < 0.6) ? 0 : y < -24.5 ? rp(R_RED, S_(sk, 0.8), d) : rp(R_SKIN, S_(sk, 0.9), d); return -1; }
      }
      return -1;
    }
    function c2Draw(V, t) {
      const pk = 0.92 + 0.08 * Math.sin(zP(t, 2)), brush = Math.sin(zP(t, 8)), trainX = -150 + 70 * Math.sin(zP(t, 2));
      const hand = [100 + 1.2 * brush, 26 - 3.5 * brush], elbow = [118, 12];
      V.each(-330, -210, 330, 210, (x, y, X, Y) => {
        const d = bay(X, Y), q = (x - LAMP[0]) ** 2 + (y - LAMP[1]) ** 2, cone = y > LAMP[1] ? sstep(-1.1, -0.4, -Math.abs(x) / (y - LAMP[1] + 18)) : 0;
        const Ll = lit(q, 120) * pk, L = 0.08 + Ll * 0.55 + cone * 0.35 * pk, Lwin = lit((x - 192) ** 2 + (y + 78) ** 2, 60) * 0.25;
        if (x > -39 && x < 39 && y > -39 && y < 49) { const g = globePix(x, y, d, -1); if (g >= 0) return g; }
        // the lamp: cord, green enamel shade, the bulb
        if (Math.abs(x) < 0.8 && y < -100) return 39;
        if (y >= -101 && y < -88 && Math.abs(x) < 6 + (y + 101) * 1.25) return y > -90.5 ? rp(R_BRASS, 0.8, d) : rp(R_PINE, clamp(0.55 - x / 40 + (y + 101) * 0.02, 0, 1), d);
        if ((x * x) / 30 + (y + 86) ** 2 / 8 < 1 && y > -88) return 22;
        // the toymaker: cap, hair and beard, face and spectacles, sweater and apron, arms, the brush
        if (x > 84 && x < 172 && y > -44 && y < 46) { const hx = x - 124, hy = y + 26;
          if (segD(x, y, hand[0], hand[1], hand[0] - 3, hand[1] - 9) < 0.7) return y < hand[1] - 7 ? 157 : 162;                 // the brush, its red tip
          if (segD(x, y, 132, -8, elbow[0], elbow[1]) < 5.2 || segD(x, y, elbow[0], elbow[1], hand[0], hand[1]) < 4.4) return Math.hypot(x - hand[0], y - hand[1]) < 3.4 ? rp(R_SKIN, clamp(0.5 + L * 0.5, 0, 1), d) : rp(R_PINE, clamp(0.2 + L * 0.8, 0, 1), d);
          const tq = ((x - 140) / 27) ** 2 + ((y - 26) / 36) ** 2;                                                           // the torso, round-shouldered
          if (tq < 1 && y < 46 && y > -12) { const ax = x - 128, apron = y > -2 && Math.abs(ax) < 11 + (y + 2) * 0.12 && !(y < 8 && Math.abs(ax) > 7), str = Math.abs(ax + 8 - (y + 2) * 0.35) < 1 && y < 0;
            if (apron) return Math.abs(y - 26) < 1 && Math.abs(ax) < 7 ? rp(R_BRASS, 0.4, d) : rp(R_CREAM, clamp(0.2 + L * 0.65 - Math.abs(ax) * 0.01, 0, 1), d);
            return rp(R_PINE, clamp(0.24 + L * 0.6 - (x - 132) * 0.006 - Math.max(0, tq - 0.7) * 0.3, 0, 1), d); }
          const hq = (hx / 12.5) ** 2 + (hy / 14) ** 2, bq = ((x - 121) / 12) ** 2 + ((y + 8) / 12) ** 2;
          if (hy < -7 && hq < 1.15 && Math.abs(hx) < 13) return rp(R_RED, clamp(0.3 + L * 0.6 - hx * 0.02, 0, 1), d);                    // the knitted cap
          if (hy > 1 && bq < 1 && y < 4) return rp(R_CREAM, clamp(0.45 + L * 0.5 - (x - 120) * 0.02, 0, 1), d);                          // the beard
          if (hq < 1) {
            if ((Math.hypot(hx + 7, hy + 1) < 3 && Math.hypot(hx + 7, hy + 1) > 2) || (Math.hypot(hx + 1, hy + 1) < 3 && Math.hypot(hx + 1, hy + 1) > 2) || (Math.abs(hy + 1) < 0.5 && hx > -5 && hx < -3)) return rp(R_BRASS, 0.9, d);
            if (Math.hypot(hx + 7, hy + 1) < 2) return d < 0.5 ? 170 : 147;                                                               // the lens, glinting
            if (Math.abs(hy - 3) < 1 && hx < -6 && hx > -11) return rp(R_SKIN, 0.4, d);
            if (hx > 6) return rp(R_CREAM, clamp(0.4 + L * 0.4, 0, 1), d);                                                                 // his white hair
            return rp(R_SKIN, clamp(0.35 + L * 0.65 - hx * 0.03, 0, 1), d);
          } }
        // on the bench: the soldier being painted, the paint pot, the hammer, shavings
        if (x > 88 && x < 96 && y > 20 && y < 46) { const k = toyPix('soldier', x - 92, y - 46, d, L); if (k >= 0) return k; }
        if (x > -78 && x < -60 && y > 34 && y < 46) return y < 36 ? rp(R_RED, 0.7, d) : rp(R_IRON, clamp(0.3 + L * 0.6 - (x + 69) * 0.03, 0, 1), d);
        if ((x > -132 && x < -100 && y > 42 && y < 45.5) || (x > -138 && x < -128 && y > 37 && y < 46)) return x < -128 ? rp([32, 33, 34], 0.5 + L * 0.4, d) : rp(R_WOOD, clamp(0.5 + L * 0.4, 0, 1), d);
        if (y > 40 && y < 47) for (let ci = 0; ci < 4; ci++) { const cx = CURLS[ci][0], cy = CURLS[ci][1]; const r = Math.hypot(x - cx, y - cy); if (r < 3.4 && r > 1.8 && y < cy + 1.2) return rp(R_WOOD, 0.85, d); }
        // the workbench
        if (y >= 46 && y < 54 && Math.abs(x) < 300) return rp(R_WOOD, clamp(0.25 + L * 0.7 - (y - 46) * 0.04 + (y < 47.5 ? 0.15 : 0) + 0.06 * Math.sin(x * 0.07 + Math.sin(x * 0.013) * 3), 0, 1), d);
        if (y >= 54 && Math.abs(x) < 300) { const dr = Math.floor((x + 300) / 74), lx = (x + 300) % 74; if (lx < 2 || (y > 80 && y < 82)) return 159; if (Math.abs(lx - 37) < 3 && Math.abs(y - 67) < 1.6) return rp(R_BRASS, 0.8, d); return rp(R_WOOD, clamp(0.12 + L * 0.5 - (y - 54) * 0.002 + ih(dr, 1, 801) * 0.06, 0, 1), d); }
        // the toys on the shelves, the shelves
        for (let ti = 0; ti < TOYS.length; ti++) { const T_ = TOYS[ti], k = T_[0], tx = T_[1], ty = T_[2]; if (ty > 40 || Math.abs(x - tx) > 14 || y > ty || y < ty - 30) continue; const c = toyPix(k, x - tx, y - ty, d, L + 0.15); if (c >= 0) return c; }
        if (Math.abs(y + 76) < 8 && Math.abs(x - trainX) < 16) {                                                                              // the train on the top shelf
          const lx = x - trainX, ly = y + 72; if (ly > -2 && ly < 0 && (Math.abs(((lx + 40) % 7) - 3.5) < 1.6)) return 39;
          if (ly <= -2 && ly > -9 && lx > -14 && lx < 10) return lx > 2 && ly < -6 ? -1 : rp(lx < -4 ? R_RED : [39, 40, 41], clamp(0.4 + L * 0.5, 0, 1), d);
          if (lx > 5 && lx < 8 && ly <= -6 && ly > -13) return 39;
          if (lx > 10 && lx < 14 && ly <= -2 && ly > -6) return rp(R_BRASS, 0.7, d); }
        for (const sy of SH) if (y >= sy && y < sy + 4 && x > -248 && x < -60) return rp(R_WOOD, clamp(0.2 + L * 0.6 + (y < sy + 1 ? 0.2 : 0), 0, 1), d);
        if (y > -76 && y < -72 && x > -248 && x < -60) return rp([32, 33], 0.3, d);                                                       // the toy train's rail
        // the window behind the toymaker, frosted, snow outside
        if (x > 150 && x < 236 && y > -106 && y < -48) {
          if (x < 154 || x > 232 || y < -102 || y > -52 || Math.abs(x - 193) < 1.6 || Math.abs(y + 77) < 1.6) return rp(R_WOOD, clamp(0.2 + L * 0.5, 0, 1), d);
          const fr = Math.min(x - 154, 232 - x, y + 102, -52 - y); if (fr < 5 && ih(fl(x * 3), fl(y * 3), 802) < (5 - fr) / 6) return 169;
          return y > -62 + 3 * Math.sin(x * 0.1) ? rp(R_SNOW, 0.5, d) : rp(R_NIGHT, 0.35 + (y + 106) / 140, d);
        }
        // the wall: boards in lamplight, a frieze
        if (y < -108) return rp(R_WOOD, clamp(0.05 + L * 0.35, 0, 1), d);
        if (y < -104 && y >= -108) return rp(R_RED, clamp(0.1 + L * 0.5, 0, 1), d);
        const bd = (x + 400) % 18 < 0.9; return bd ? 159 : rp(R_LOG, clamp(L * 0.85 + Lwin + ih(fl((x + 400) / 18), 2, 803) * 0.07, 0, 1), d);
      });
      zSnow(V, t, 154, -102, 232, -52, 9, 811, 1, [137, 168, 169, 170], (x, y) => Math.abs(x - 193) > 1.6 && Math.abs(y + 77) > 1.6);
      zGlow(V, 0, -84, 60, T_WARM, 0.32 * pk); zGlow(V, 0, -86, 12, T_GOLD, 0.5);
    }
    ZL[2] = { name: 'workshop', draw: c2Draw, mask: globeMask, maskBox: GLOBE_BOX, hole: GLOBE_HOLE };
  }

  /* ================================================================ L3 — the village, inside the cabin's snow globe
     A snowy square at night under the moon. In the middle the toy shop, painted green, its roof deep in snow, a chimney
     smoking, lights along the eave, a gold-lettered sign, lanterns either side, a red door with a wreath, and its wide
     window glowing (the window to L2, the workshop). Cottages either side with lit windows; a street lamp; a snowman; a
     frozen pond with two skaters going round. Snow falls over all of it. */
  {
    const MOON = [-100, -94, 11];
    const roofIn = (x, y, cx, peak, base, hw) => y > peak + Math.abs(x - cx) * ((base - peak) / hw) && y <= base;
    const HOUSES = [[-262, -104, -34, -183, -104, 92, [[-230, -206], [-160, -136]], -14], [104, 264, -28, 184, -98, 94, [[130, 154], [206, 230]], -10],
      [-360, -262, -20, -311, -70, 56, [[-326, -306]], -4], [264, 360, -16, 312, -66, 56, [[298, 318]], 0]];
    const SIGN = 'TOYS', SIGN_SC = 1.8, SIGN_X = -textW(SIGN, SIGN_SC) / 2;
    function c3Draw(V, t) {
      const lampK = flick(t, 2.1);
      V.each(-360, -300, 360, 300, (x, y, X, Y) => {
        const d = bay(X, Y), qw = x * x + (y - 28) * (y - 28), Lw = lit(qw, 70) * 0.8, Ll = lit((x + 112) ** 2 + (y + 44) ** 2, 40) * lampK;
        // the snowman (in front of the left cottage)
        if (x > -170 && x < -130 && y > 34 && y < 86) { const q1 = (x + 150) ** 2 + (y - 72) ** 2, q2 = (x + 150) ** 2 + (y - 55) ** 2, q3 = (x + 150) ** 2 + (y - 42) ** 2;
          if (q3 < 36 && Math.abs(y - 41) < 0.8 && (Math.abs(x + 152) < 0.8 || Math.abs(x + 148) < 0.8)) return 1;
          if (y > 42 && y < 44 && x > -150 && x < -150 + 6 - (y - 42) * 2) return 146;                       // the carrot
          if (y > 46.5 && y < 49.5 && Math.abs(x + 150) < 6.5) return rp(R_RED, 0.6 - (x + 150) * 0.03, d);    // the scarf
          if (y > 48 && y < 58 && x > -146 && x < -142 && y < 49.5 + (x + 146) * 2) return rp(R_RED, 0.4, d);
          if (q1 < 169 || q2 < 81 || q3 < 36) { const nx = x + 150 + 4, s = 0.75 - nx * 0.02 - (y - 40) * 0.004; return rp(R_SNOW, clamp(s, 0.2, 1), d); }
          if (Math.abs((x + 150) + (y - 55) * 1.4 + 22) < 0.8 && x < -158 && x > -168) return 28;              // twig arms
          if (Math.abs((x + 150) - (y - 55) * 1.4 - 22) < 0.8 && x > -142 && x < -132) return 28; }
        // the street lamp
        if (x > -114 && x < -110 && y > -36 && y < 50) return d < 0.3 ? 40 : 39;
        if (x > -119 && x < -105 && y > -52 && y < -36) { if (y < -49 || y > -39 || Math.abs(x + 112) > 5) return 40; return rp(R_FIRE, 0.75 + 0.15 * lampK, d); }
        // the toy shop: sign, window, door, lanterns, wall, roof, chimney
        if (Math.abs(x) < 46 && y > -50 && y < -34) {
          if (Math.abs(x) > 44 || y < -48.5 || y > -35.5) return rp(R_BRASS, 0.6, d);
          if (glyphAt(SIGN, x, y, SIGN_X, -48.5, SIGN_SC)) return rp(R_BRASS, 0.85 + (y < -44 ? 0.1 : 0), d);
          return rp(R_WOOD, 0.2, d);
        }
        if (Math.abs(x) < 41 && Math.abs(y) < 27) {
          if (Math.abs(x) < 36 && Math.abs(y) < 22) { const s = 0.55 + 0.25 * Math.sin(x * 0.2) * Math.sin(y * 0.3); return rp(R_FIRE, s, d); }   // (the glass, glowing; L2 shows through)
          if (y < -22 && y > -27) return rp(R_SNOW, 0.8, d);                                                   // snow on the frame's top
          if (Math.abs(x) < 37.2 || Math.abs(y) < 23.2) return rp(R_BRASS, 0.75, d);
          return rp(R_RED, clamp(0.45 + Lw * 0.4 - (x > 0 ? 0.1 : 0), 0, 1), d);
        }
        if (Math.abs(x) < 46 && y >= 27 && y < 32) return y < 29 + Math.sin(x * 0.5) ? rp(R_SNOW, 0.85, d) : rp(R_RED, 0.3, d);     // the sill, snowed on
        if (x > 52 && x < 80 && y > -22 && y < 50) {
          const wq = (x - 66) ** 2 + (y + 6) ** 2;
          if (wq < 64 && wq > 20) return (x > 62 && x < 70 && y > 0 && y < 5) ? rp(R_RED, 0.7, d) : rp(R_PINE, 0.45 + (x < 66 ? 0.2 : 0), d);
          if (x > 76 && x < 78 && y > 14 && y < 20) return rp(R_BRASS, 0.8, d);
          const panel = (Math.abs(x - 59) < 4 || Math.abs(x - 73) < 4) && ((y > 6 && y < 22) || (y > 28 && y < 44));
          return rp(R_RED, clamp(0.3 + (panel ? -0.1 : 0.05) + Lw * 0.2, 0, 1), d);
        }
        for (const sx of [-54, 54]) if (Math.abs(x - sx) < 4 && y > -44 && y < -32) return Math.abs(y + 38) < 4 && Math.abs(x - sx) < 2.5 ? 16 : 174;
        if (x > 46 && x < 62 && y > -146 && y < -100) { if (y < -140) return rp(R_SNOW, 0.8, d); const br = ((y + 146) % 6 < 0.8) || ((x + (fl((y + 146) / 6) % 2) * 4) % 8 < 0.8); return br ? 121 : rp(R_RED, 0.25, d); }
        if (roofIn(x, y, 0, -150, -66, 112)) { const e = y - (-150 + Math.abs(x) * (84 / 112)); if (y > -70) return 1; return rp(R_SNOW, clamp(0.55 + (x < 0 ? 0.18 : -0.05) - (e > 60 ? 0.1 : 0) + 0.06 * Math.sin(x * 0.3), 0, 1), d); }
        if (Math.abs(x) < 96 && y >= -66 && y < 50) {
          if (y < -61) { const on = Math.sin(x * 0.8) > 0.6; return on ? ((fl(x / 4) & 1) ? 16 : 157) : 150; }   // the eave's garland and lights
          const board = (x + 200) % 8 < 0.8; return board ? 149 : rp(R_PINE, clamp(0.15 + Lw * 0.55 + Ll * 0.2 + ih(fl((x + 200) / 8), 3, 701) * 0.12, 0, 1), d);
        }
        // the cottages either side
        for (const [hx0, hx1, wy, rcx, rpk, rhw, wins, wwy] of HOUSES) {
          if (roofIn(x, y, rcx, rpk, wy, rhw)) return y > wy - 3 ? 1 : rp(R_SNOW, clamp(0.5 + (x < rcx ? 0.15 : -0.05), 0, 1), d);
          if (x >= hx0 && x < hx1 && y >= wy && y < 50) {
            for (const [a, b] of wins) if (x >= a && x < b && y >= wwy && y < wwy + 24) { const mx = (a + b) / 2; if (Math.abs(x - mx) < 1 || Math.abs(y - wwy - 12) < 1) return 159; return rp(R_FIRE, 0.55 + 0.15 * Math.sin(x * 0.3 + y * 0.2), d); }
            if (y >= wwy + 24 && y < wwy + 27) for (const [a, b] of wins) if (x >= a - 2 && x < b + 2) return rp(R_SNOW, 0.8, d);
            const tim = ((x - hx0) % 22 < 2) || (y - wy) % 26 < 2; return tim ? 160 : rp(R_STONE, clamp(0.18 + Ll * 0.3 + Lw * 0.15 + 0.05 * Math.sin(x * 0.7 + y), 0, 1), d);
          }
        }
        // the ground: snow, warm under the shop window, with the pond and its ice
        if (y >= 50 + 1.5 * Math.sin(x * 0.04)) {
          const pq = ((x - 112) / 72) ** 2 + ((y - 88) / 13) ** 2;
          if (pq < 1) { const gl = Math.sin(x * 0.15 - y * 0.6) > 0.85 ? 0.25 : 0; return rp([135, 136, 137, 138, 167, 168], clamp(0.45 + gl + Lw * 0.3 - pq * 0.25, 0, 1), d); }
          const sp = ih(fl(x * 2), fl(y * 2), 702) > 0.997 && Math.sin(zP(t, 3) + x) > 0 ? 22 : -1; if (sp >= 0) return sp;
          return rp(R_SNOW, clamp(0.42 + 0.08 * vn(x * 0.05, y * 0.1, 1, 703) + Lw * 0.35 + Ll * 0.2 - Math.max(0, y - 120) * 0.0015, 0, 1), d);
        }
        // the hills and the sky, the moon
        if (y > -6 + 10 * Math.sin(x * 0.012 + 1) + 5 * Math.sin(x * 0.031)) return rp(R_SNOW, 0.25 + 0.05 * Math.sin(x * 0.05), d);
        const mq = (x - MOON[0]) ** 2 + (y - MOON[1]) ** 2;
        if (mq < MOON[2] * MOON[2]) { const cr = vn(x * 0.4, y * 0.4, 1, 704) > 0.62 ? -0.15 : 0; return rp([168, 169, 170, 22], clamp(0.8 - (x - MOON[0]) * 0.02 + cr, 0, 1), d); }
        return rp(R_NIGHT, clamp(0.85 + y / 260, 0, 1), d);
      });
      zStars(V, t, -360, -300, 360, -10, 5, 705, [135, 136, 168, 169, 22], (x, y) => y < -6 + 10 * Math.sin(x * 0.012 + 1) + 5 * Math.sin(x * 0.031) - 2 && !HOUSES.some(([a, b, wy, rcx, rpk, rhw]) => y > rpk + Math.abs(x - rcx) * ((wy - rpk) / rhw)) && !(y > -150 + Math.abs(x) * (84 / 112)));
      // the skaters, going round the pond (leaning into the turn)
      for (let k = 0; k < 2; k++) {
        const a = zP(t, 1) + k * PI, sx = 112 + Math.cos(a) * 50, sy = 86 + Math.sin(a) * 6, lean = -Math.sin(a) * 0.25, cols = k ? R_RED : [88, 45, 46, 47];
        if (!V.vis(sx - 8, sy - 16, sx + 8, sy + 2)) continue;
        V.each(sx - 8, sy - 16, sx + 8, sy + 1, (x, y, X, Y) => {
          const dy = sy - y, dx = x - sx - lean * dy, d = bay(X, Y);
          if (dy > 12.5 && dy < 15 && Math.abs(dx) < 2.2) return rp(R_RED, 0.5, d);                                   // the hat
          if (dy > 10 && dy <= 12.5 && Math.abs(dx) < 2) return rp(R_SKIN, 0.7, d);
          if (dy > 4 && dy <= 10 && Math.abs(dx) < 2.6 - (dy - 7) * 0.1) return rp(cols, 0.5 - dx * 0.08, d);
          const leg = 1.5 * Math.sin(a * 2 + k); if (dy > 0.6 && dy <= 4 && (Math.abs(dx + 1 + leg * (4 - dy) * 0.2) < 0.8 || Math.abs(dx - 1 - leg * (4 - dy) * 0.2) < 0.8)) return 39;
          if (dy >= 0 && dy <= 0.6 && Math.abs(dx) < 3) return 34;
          return -1;
        });
      }
      // the chimney's smoke, rising and drifting
      for (let j = 0; j < 22; j++) { const ph = frac(j / 22 + t / 3.75), y = -146 - ph * 70, x = 54 + ph * 22 + 4 * Math.sin(ph * 5 + zP(t, 1)), r = 2 + ph * 6; if (V.vis(x - r, y - r, x + r, y + r)) V.each(x - r, y - r, x + r, y + r, (px, py, X, Y) => (px - x) ** 2 + (py - y) ** 2 < r * r && bay(X, Y) < (1 - ph) * 0.4 ? 18 : -1); }
      // light: the shop's window on the snow, the lanterns, the lamp, the moon
      zGlow(V, 0, 30, 70, T_WARM, 0.3); zGlow(V, -112, -44, 26, T_WARM, 0.4 * lampK); zGlow(V, -54, -38, 10, T_GOLD, 0.35); zGlow(V, 54, -38, 10, T_GOLD, 0.35);
      zGlow(V, MOON[0], MOON[1], 40, T_WH, 0.12);
      // and the snow, falling over everything
      zSnow(V, t, -360, -300, 360, 300, 8, 706, 2);
    }
    ZL[3] = { name: 'village', draw: c3Draw, mask: paneMask, maskBox: PANE_BOX, hole: PANE_HOLE };
  }

  /* ================================================================ Snow Globe: the film is one shot */
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
    lifeTick(t, S);
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
  if (typeof window !== 'undefined') window.__globe_core = { render, BUF, PAL, W, H, D, SHAKE: () => [SHX, SHY] };
  (window.PIECES = window.PIECES || []).push({
    id: 'snow-globe',
    title: 'Snow Globe',
    medium: 'Pixel art, 480 × 270, drawn in JavaScript · a 15 s loop',
    note: 'An endless zoom · tap to pause',
    about: 'A snow globe on a cabin table. Inside it, a village in the snow, and a toy shop window lit for Christmas; inside the shop, a snow globe on the workbench; inside that, a cabin in the woods, and through its window, the table and the globe again. One unbroken push in, fifteen seconds, round and round.',
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
        window.__theglobe = {
          duration: D,
          isReady: () => ready && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__theglobe.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-unmaker';
        api.ready();
      } else {
        window.__theglobe = { duration: D, isReady: () => ready, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
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
          if (window.__theglobe) delete window.__theglobe;
        },
      };
    },
  });

})();
