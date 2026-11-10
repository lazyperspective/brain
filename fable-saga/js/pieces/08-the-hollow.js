/* The Hollow — Fable Saga, part V.
 *
 * A forty-second pixel-art duel. The ash of both brothers pours into the hero's own shadow and the shadow stands up: its own
 * size, its own speed, its own moves. The sky is glass; every heavy blow cracks it, and behind each shard is another world.
 * Every frame is a pure function of t: drawn into a 480 × 270 indexed buffer, then lit and graded in true colour and shown
 * at 4×. Built from the parts in fable-saga/production/part5/src. An unofficial fan concept, not affiliated with Anthropic.
 */
(function () {
  'use strict';
  /* ================================================================ constants & helpers */
  const W = 480, H = 270, NP = W * H, D = 40;
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
    // part V
    '061014', '0c2026', '15363c', '235658', '3f8a7a', '86ceb0',                                   // 124-129 the folded city (teal night)
    'ff6f7d', 'ffa68a', 'c2456e', '7a2d6a',                                                       // 130-133 dawn rose, peach, deep rose, plum
    '040308',                                                                                     // 134 the Hollow's inside (a marker: stars are painted into it on screen)
    'c8ecff', '7fb8e0', '3c6c9c',                                                                 // 135-137 glass
    '0a0916', '1a1838',                                                                           // 138-139 dawnbreak night
    'fff2c8', 'ffd070',                                                                           // 140-141 dawn fire
    'e9e2d2', 'cfc6b2', '2a2622',                                                                 // 142-144 paper shade, paper dark, warm ink
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
  function spSword(px, py, ang, cols, st, len) {
    len = len || 30; const ST = st || '';
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const RG = Math.max(34, len + 4);
    for (let dy = -RG; dy <= RG; dy++) for (let dx = -RG; dx <= RG; dx++) {
      const fx = dx + 0.5, fy = dy + 0.5, u = fx * ca + fy * sa, v = -fx * sa + fy * ca, av = Math.abs(v);
      let c = -1;
      if (u >= -6 && u < -4.5 && av <= 1.4) c = ST === 'void' ? 73 : 58;                          // pommel
      else if (u >= -4.5 && u < 0.5 && av <= 1.0) c = ST === 'void' ? 78 : 38;                    // grip
      else if (u >= 0.5 && u < 2.5 && av <= 4.2) c = ST === 'void' ? (av > 3.2 ? 74 : 72) : ST === 'dawn' ? (v < 0 ? 22 : 56) : av > 3.2 ? 51 : 58;     // guard
      else if (u >= 2.5 && u < len) {
        let tw = u > len - 5 ? (len - u) * 0.36 : 1.8;
        if (ST === 'stub') tw = u > len - 3 ? (ih(fl(u * 2), 3, 951) < 0.5 ? 1.8 : 0.6) * (v < 0 ? 1 : 0.4) : 1.8;   // a broken, jagged end
        if (av <= tw) c = ST === 'void' ? (v < -0.6 ? 74 : 134) : ST === 'dawn' ? (v < 0 ? 22 : v < 0.7 ? 138 : 134) : cols ? (v < -0.6 ? 22 : cols[fl(frac(u * 0.08) * cols.length)]) : (v < -0.7 ? 22 : u < 5 ? 33 : 34);
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
  const FORMS = { hollow: [134, 134, 134, 72], hollownova: [134, 0, 134, 22], dawnbreak: [140, 141, 22, 59], storm: [90, 89, 91, 91], grey: [94, 93, 95, 92], zenith: [60, 59, 22, 22], nova: [108, 110, 22, 105], lastlight: [111, 96, 113, 104], infinite: [60, 85, 22, 22] };
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
      const NC = o.form === 'nova', lc = NC ? (fl(tf * 16) % 4 ? 101 : 104) : F ? (o.form === 'lastlight' ? (fl(tf * 20) % 3 ? 107 : 22) : 22) : 107, lc2 = NC ? 103 : o.form === 'lastlight' ? 104 : F ? F[2] : 103;
      for (let k = 0; k < CRACKS.length; k++) {
        const C = CRACKS[k]; if (C.at > crk) continue;
        const grow = clamp((crk - C.at) / 0.25, 0, 1), n = Math.max(2, Math.ceil(C.p.length * grow));
        for (let q = 0; q + 1 < n; q++) { const [ua, va] = C.p[q], [ub, vb] = C.p[q + 1]; for (let m = 0; m <= 6; m++) { const u = lerp(ua, ub, m / 6), v = lerp(va, vb, m / 6), px = x0 + u * (bw - 1), py = y0 + v * (bh - 1); sp(px, py, q === 0 ? lc2 : lc, 1); if (C.w && m % 2 === 0) sp(px + 1, py, lc2, 1); } }
      }
    }
    // part V. The Hollow: the hero's block cut out of the picture (its inside is painted on screen, after the stamp), a cracked
    // half-mask of porcelain over the back half of its face. Dawnbreak: night on the back half, dawn fire on the sword side.
    const HOL = o.form === 'hollow' || o.form === 'hollownova', DBK = o.form === 'dawnbreak';
    if (o.form === 'hollownova') for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) { const e = Math.min(i, j, bw - 1 - i, bh - 1 - j) + (ih(i, j + fl(tf * 14), 961) < 0.3 ? 1 : 0); if (e < 1) sp(x0 + i, y0 + j, 22, 1); else if (e < 2 && ((i + j + fl(tf * 10)) & 1)) sp(x0 + i, y0 + j, 20, 1); }
    if (DBK) for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      const edge = bw * 0.46 + Math.sin(j * 0.9 + tf * 7) * 1.3 + Math.sin(j * 0.37 - tf * 4) * 1.2, d = i - edge;
      if (d < -1) sp(x0 + i, y0 + j, j === 0 ? 139 : 134, 1);
      else if (d < 0.6) sp(x0 + i, y0 + j, 22, 1);
      else { const u = (i - edge) / (bw - edge), v = (j + 0.5) / bh - 0.5, r = Math.sqrt(u * u * 0.5 + v * v * 1.6) + Math.sin(j * 1.3 + tf * 9) * 0.03; sp(x0 + i, y0 + j, r < 0.3 ? 22 : r < 0.45 ? 140 : r < 0.62 ? 141 : 110, 1); }
    }
    if (DBK) for (let k = 0; k < 4; k++) { const lc = k < 2 ? 139 : 141; for (let j = 0; j < Math.max(1, lh - lift[k]); j++) spRect(lx[k] + Math.round(shx * (j + 1) / lh), y1 + j, 4, 1, k < 2 ? (j === 0 ? 134 : lc) : (j < 2 ? 140 : lc), 1); }
    if (HOL && o.mask !== false) {
      const chip = o.maskChip || 0, mw = Math.round(bw * 0.52), mh = Math.round(bh * 0.78);
      for (let j = 1; j < mh; j++) for (let i = 1; i < mw; i++) {
        const jag = Math.round(Math.sin(j * 1.9) * 1.2 + (ih(j, 2, 962) - 0.5) * 2.2), lim = mw - 2 + jag - (j > mh - 4 ? (j - mh + 4) * 2 : 0);
        if (i > lim) continue;
        if (j > mh - 3 && i < 3 + (j - mh + 3)) continue;                                       // a chipped corner
        if (chip > 0 && (i + j * 0.8 > mw + mh * 0.2 - chip * 9 && j < mh * 0.5 + chip * 3)) continue;   // the cheek broken away
        if (chip > 0.6 && i < 2 + chip * 3 && j < 3 + chip * 3) continue;
        let c = j < 2 ? 64 : i < 2 ? 65 : j > mh - 3 ? 66 : i >= lim - 1 ? 66 : (i + j) % 7 === 0 ? 65 : 64;
        if (Math.abs(i - (mw * 0.55 - j * 0.35 + (ih(j, 3, 962) - 0.5) * 1.5)) < 0.6 && j < mh * 0.62) c = 68;   // the crack down to the eye
        if (chip > 0.3 && Math.abs(j - (mh * 0.72 - i * 0.3)) < 0.6 && i > 3) c = 68;
        sp(x0 + i, y0 + j, c, 1);
      }
    }
    // arms
    const ay = y0 + Math.round(bh * 0.34), ah = Math.max(3, Math.round(bh * 0.32)), ar = Math.round(o.reach || 0);
    const hasSw = o.sword !== undefined && o.sword !== null, armA = o.armA !== undefined ? o.armA : hasSw ? clamp(o.sword * 0.45, -1.1, 0.9) : 0;
    const limbS = (sx, sy, a, len, c) => { const ca = Math.cos(a), sa = Math.sin(a); for (let q = 0; q <= len; q += 0.5) for (let v = -ah / 2 + 0.25; v < ah / 2; v += 0.5) sp(sx + ca * q - sa * v, sy + sa * q + ca * v, c, 1); };
    const shY = ay + ah / 2 - 0.5;
    const A2 = o.arm2 || null, bodyR = DBK ? 140 : body, bodyL = DBK ? 139 : HOL ? body : N ? body : dark;
    limbS(x0 + 1, shY, A2 ? A2[0] : PI - armA * 0.6, A2 ? A2[1] : 4.5, bodyL); limbS(x0 + bw - 1, shY, armA, 3.5 + ar, bodyR);
    if (A2 && A2[2]) { const hx2 = x0 + 1 + Math.cos(A2[0]) * (A2[1] + 1), hy2 = shY + Math.sin(A2[0]) * (A2[1] + 1); for (let jj = -2; jj <= 2; jj++) for (let ii = -2; ii <= 2; ii++) if (Math.abs(ii) + Math.abs(jj) < 4) sp(hx2 + ii, hy2 + jj, bodyL, 1); }
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
    if (HOL) {
      // one magenta eye in the mask (the Unmaker's), one crimson eye burning in the void (the Sunderer's)
      const op = e === 'closed' ? 0 : e === 'narrow' ? 1 : e === 'wide' ? 3 : 2, fk = fl(tf * 12);
      if (op) { const h = op === 1 ? 1 : op === 3 ? 4 : 3, yy = ey + (op === 1 ? 1 : op === 3 ? -1 : 0);
        if (o.eyeM !== false) { spRect(ex0 - 1, yy - 1, 4, h + 2, 69, 1); spRect(ex0, yy, 2, h, 73, 1); sp(ex0 + (fk % 5 === 0 ? 1 : 0), yy, 75, 1); }
        if (o.eyeC !== false) { spRect(ex1, yy, 2, h, 104, 1); sp(ex1 + 1, yy, 107, 1); if (op > 1) { sp(ex1 + (fk & 1), yy - 1, 103, 1); sp(ex1 + 1 - (fk & 1), yy - 2, 102, 1); } }
        else { sp(ex1, yy + 1, 102, 1); sp(ex1 + 1, yy + 2, 101, 1); sp(ex1 - 1 + (fk % 3), yy + 3 + (fk % 2), 103, 1); } }
    } else if (DBK) {
      const h = e === 'narrow' ? 2 : 3, yy = ey + (e === 'narrow' ? 1 : 0);
      if (e === 'closed') { spRect(ex0, ey + 2, 2, 1, 57, 1); spRect(ex1, ey + 2, 2, 1, 0, 1); }
      else { spRect(ex0 - 1, yy - 1, 4, h + 2, 56, 1); spRect(ex0, yy, 2, h, 22, 1); spRect(ex1 - 1, yy - 1, 4, h + 2, 105, 1); spRect(ex1, yy, 2, h, 0, 1); sp(ex1 + 1, yy, 22, 1); }
    } else { eye(ex0, -1); eye(ex1, 1); }
    if (o.mouth) { const mw = o.mouth > 1 ? 8 : 4, mh = o.mouth > 1 ? 4 : 2; spRect(-mw / 2, ey + 5, mw, mh, N ? 42 : 0, 1); if (N) for (let i = -mw / 2; i < mw / 2; i += 2) sp(i, ey + 5, 39, 1); else if (o.mouth > 1) spRect(-mw / 2 + 1, ey + 5 + mh - 1, mw - 2, 1, 36, 1); }
    // sword on the right arm nub
    if (hasSw) spSword(handX, handY, o.sword, o.swordCols || null, o.swordSt || (HOL ? 'void' : DBK ? 'dawn' : ''), o.swordLen);
    // outline
    const oc = o.outline !== undefined ? o.outline : N ? 42 : F ? F[3] : 22, prism = o.form === 'zenith' || o.form === 'infinite', pf = fl(T_NOW * 12);
    const src = SPR.slice();
    for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
      const i = y * SW + x; if (src[i]) continue;
      if (src[i - 1] || src[i + 1] || src[i - SW] || src[i + SW]) { const nsw = SPK[i - 1] === 2 || SPK[i + 1] === 2 || SPK[i - SW] === 2 || SPK[i + SW] === 2;
        SPR[i] = (nsw ? (o.swordOut !== undefined ? o.swordOut : HOL ? 72 : DBK ? 59 : N ? 42 : 1) : prism ? 81 + ((((x + y) >> 1) + pf) % 7) : o.form === 'hollow' ? (x - SOX < 0 ? 72 : 102) : DBK ? (x - SOX < -1 ? 56 : 59) : oc) + 1; SPK[i] = 4; }
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
      if (opt.clipY !== undefined && Y > opt.clipY) continue;
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
      const cc = opt.cols2 && (x < opt.splitX) ? opt.cols2 : cols;
      BUF[i] = f < 0.25 ? cc[3] : f < 0.55 ? cc[2] : f < 0.82 ? cc[1] : cc[0];
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
    void: [22, 74, 0, 0], dawn: [22, 140, 22, 22],
  };
  function bigBlade(hx, hy, a, len, w, t, o) {
    o = o || {};
    const form = o.form || 'gold', cols = BLADE_COLS[form], ux = Math.cos(a), uy = Math.sin(a), grow = o.grow === undefined ? 1 : o.grow;
    const L = len * grow, tipK = 0.86;
    // the guard and grip at the hand
    const gw = w * 1.7, gx = -uy, gy = ux;
    const VD = form === 'void', DW = form === 'dawn';
    if (!o.noHilt) { capsF(hx - gx * gw, hy - gy * gw, hx + gx * gw, hy + gy * gw, Math.max(1.5, w * 0.28), Math.max(1.5, w * 0.28), (u, d) => VD ? (d > 0.7 ? 74 : 72) : DW ? (u < 0.5 ? 22 : 56) : d > 0.7 ? 51 : 58);
    capsF(hx - ux * w * 1.4, hy - uy * w * 1.4, hx, hy, Math.max(1.2, w * 0.2), Math.max(1.2, w * 0.2), () => VD ? 78 : 38); }
    // the blade, clipped to the frame
    const reach = Math.min(L, 2000), tx = hx + ux * reach, ty = hy + uy * reach;
    const pad = w * 3 + 4, x0 = Math.max(0, fl(Math.min(hx, tx) - pad)), x1 = Math.min(W - 1, Math.ceil(Math.max(hx, tx) + pad)), y0 = Math.max(LB, fl(Math.min(hy, ty) - pad)), y1 = Math.min(H - LB - 1, Math.ceil(Math.max(hy, ty) + pad));
    const snap = o.snap, so = o.snapOff || [0, 0], flare = o.flare === undefined ? 0.6 : o.flare, Tg = VD ? T_MAG : DW ? T_WH : form === 'nova' ? T_NOVA : form === 'lastlight' ? T_EMBER : form === 'infinite' ? T_WH : T_GOLD;
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
      else if (VD) c = e > 0.86 ? 22 : e > 0.72 ? (bay(x, y) < 0.5 + 0.4 * Math.sin(along * 0.2 - t * 20) ? 74 : 72) : ih(x, y, 1123) < 0.012 ? 57 : (vn(along - t * 60, across * 2, 9, 1124) > 0.66 ? 77 : 0);
      else if (DW) c = across < -half * 0.08 ? (e > 0.8 ? 141 : e > 0.45 ? 140 : 22) : across < half * 0.1 ? 22 : e > 0.84 ? 56 : ih(x, y, 1125) < 0.02 ? 57 : 138;
      else c = e < 0.3 ? cols[3] : e < 0.55 ? cols[2] : e < 0.82 ? cols[1] : cols[0];
      // energy racing out along it while it grows, and the fuller the blade the brighter its spine
      if (grow < 1 || o.surge) { const ph = frac(along / (w * 7) - t * 6); if (ph < 0.12 && e < 0.8) c = 22; }
      if (o.cracks > 0 && ih(fl(along / 6), fl(across / 3), 1121) < o.cracks * 0.15 && e > 0.2) c = form === 'lastlight' || VD ? 22 : 96;
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

  /* ================================================================ part V: the duel kit
     Two fighters of the same size, each a pure function of its key track (no stateful physics: any frame can be seeked and
     renders the same). A fighter leans and stretches along its path, its wings drag behind its motion, its blade leaves a
     crescent, it throws its own light on the world (light()), and the Hollow's inside is painted on screen after the stamp:
     a hole in the picture with stars in it. */
  const L_WH = [1, 1, 1], L_WARM = [1, 0.72, 0.4], L_GOLD = [1, 0.82, 0.38], L_MAG = [1, 0.25, 0.8], L_CRIM = [1, 0.22, 0.12], L_COLD = [0.55, 0.8, 1], L_VIO = [0.62, 0.42, 1], L_DARK = [-1, -1, -1];
  const H5NUM = Z5NUM.concat(['lk', 'glow', 'cr', 'aur', 'dim', 'wl', 'wr', 'chip', 'swl', 'ws', 'clipY']);
  // a track: K() fills fields forward; arcs: { endKeyTime: bow px }
  function TR(keys, arcs) { const k = K(...keys); if (arcs) { k.arcs = new Map(); for (const a in arcs) k.arcs.set(+a, arcs[a]); } return k; }
  function h5Trk(keys, t) {
    let k = 0; while (k < keys.length - 1 && keys[k + 1].t <= t) k++;
    const A = keys[k], B = keys[k + 1], o = Object.assign({}, A);
    if (B && t > A.t) {
      const u = (typeof B.e === 'function' ? B.e : EASE[B.e || 'io'])(clamp((t - A.t) / (B.t - A.t), 0, 1));
      for (const f of H5NUM) if (typeof A[f] === 'number' && typeof B[f] === 'number') o[f] = A[f] + (B[f] - A[f]) * u;
      const arc = keys.arcs && keys.arcs.get(B.t);
      if (arc) { const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, b = Math.sin(PI * u) * arc; o.x += dy / L * b; o.y -= dx / L * b; }
    }
    return o;
  }
  function h5Pose(keys, tt) {
    const p = h5Trk(keys, tt), q = h5Trk(keys, tt - 1 / 30), r = h5Trk(keys, tt - 0.1);
    const vx = (p.x - q.x) * 30, vy = (p.y - q.y) * 30, sp = Math.hypot(vx, vy);
    p.vx = vx; p.vy = vy; p.sp = sp; p.svx = (p.x - r.x) * 10;
    p.st = p.nost ? 0 : clamp((sp - 110) / 1250, 0, 0.42); p.sd = Math.atan2(vy, vx);
    p.lean = p.nolean ? 0 : clamp(p.svx / 2600, -0.16, 0.16);
    p.ang = (p.a || 0) + p.lean;
    p.wa = (p.flip ? PI - (p.sw || 0) : (p.sw || 0)) + p.ang;
    return p;
  }
  // the hero bleeding light: sparks seeping from its cracks and falling, more the worse it is hurt
  function h5Bleed(x, y, S, t, amt, cols) {
    const n = fl(4 + 18 * amt);
    for (let k = 0; k < n; k++) {
      const age = frac(ih(k, 1, 7321) + t * (0.8 + ih(k, 2, 7321) * 0.7)), px = x + (ih(k, 3, 7321) - 0.5) * 22 * S + Math.sin(age * 6 + k) * 2, py = y + (ih(k, 4, 7321) - 0.6) * 12 * S + age * age * 40 * S * 0.3;
      if (bay(fl(px), fl(py)) > (1 - age) * (0.6 + 0.6 * amt)) continue;
      P(px, py, cols[age < 0.3 ? 2 : age < 0.6 ? 0 : 1]); if (age < 0.4 && k % 3 === 0) P(px, py - 1, cols[1]);
    }
    if (amt > 0.3) light(x, y, 20 * S, L_WARM, 0.12 * amt * (0.5 + 0.5 * Math.sin(t * 23)));
  }
  // the hit-stop clock in one call: [track time, frozen]; while frozen the picture shakes
  function h5Clock(t, hits, d, shake) { const fz = h5Frz(t, hits, d || 0.1); if (fz) shk(shake === undefined ? 2.4 : shake); return [h5Stop(t, hits, d || 0.1), fz]; }
  // a camera that frames two fighters: the midpoint of their bodies over the last 0.25 s, the zoom from how far apart they
  // are (fill: the screen px their separation plus pad should take), clamped to [zmin, zmax]. Pure function of t.
  function h5Frame(A, B, t, o) {
    o = o || {}; let sx = 0, sy = 0, sz = 0; const N = 6;
    for (let k = 0; k < N; k++) {
      const tt = t - k * 0.05, a = h5Trk(A, tt), b = h5Trk(B, tt), d = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y) * 1.7);
      sx += (a.x + b.x) / 2; sy += (a.y + b.y) / 2; sz += clamp((o.fill || 300) / (d + (o.pad || 90)), o.zmin || 1, o.zmax || 2.2);
    }
    return { x: sx / N + (o.ox || 0), y: sy / N + (o.oy || 0), z: sz / N };
  }
  // a heavy blow: h5Heavy, plus a spray of glass (each piece carrying a view of another world) and debris thrown along dir
  function h5Blow(x, y, g, pw, dir, cols, seed, imp, keep, lcol, views) { h5Heavy(x, y, g, pw, dir, cols, seed, imp, keep, lcol); h5Spray(x, y, g, pw, dir, cols, seed, views); }
  // the spray part of h5Blow alone: refracting glass and debris thrown along dir (undefined: every way)
  function h5Spray(x, y, g, pw, dir, cols, seed, views) {
    if (g < 0 || g > 1.1) return;
    views = views || ['dawn', 'ocean', 'city', 'ink'];
    const d0 = dir === undefined ? -PI / 2 : dir, n = fl(6 + 5 * pw);
    for (let k = 0; k < n; k++) {
      const a = d0 + (ih(k, 1, seed + 17) - 0.5) * (dir === undefined ? TAU : 1.3), v = (140 + ih(k, 2, seed + 17) * 300) * Math.sqrt(pw), px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 150 * g * g, r = (3 + ih(k, 3, seed + 17) * 6) * Math.sqrt(pw) * (1 - g * 0.6);
      if (px < -30 || px > W + 30 || py < -30 || py > H + 30 || r < 1.2) continue;
      h5Shard(shardPts(px, py, r * 1.5, r, g * (5 + k) + k, 90 + k + seed % 50, 4 + (k % 3)), views[k % views.length], 60 + k * 41 % 360, 60 + k * 23 % 150, T_NOW, { seed: k, glint: k % 3 === 0 });
    }
    rocks(x, y, g, fl(8 + 6 * pw), 220 * Math.sqrt(pw), 2.4, [137, 136, 135, 22], seed + 23, 200, d0, dir === undefined ? 6.3 : 1.2);
    for (let k = 0; k < 14 * pw; k++) { const a = d0 + (ih(k, 4, seed + 17) - 0.5) * 0.9, v = 300 + ih(k, 5, seed + 17) * 400, px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g; if (g < 0.35 && bay(fl(px), fl(py)) < 1 - g / 0.35) lineP(px, py, px - Math.cos(a) * 10, py - Math.sin(a) * 10, k % 2 ? 22 : cols ? cols[1] : 59); }
  }
  // hit-stop that does not move the cues: the clock holds for d after each hit, then runs fast until it has caught up
  function h5Stop(t, hits, d) {
    let o = t;
    for (const h0 of hits) { const h = Array.isArray(h0) ? h0[0] : h0, dd = Array.isArray(h0) ? h0[1] : d, g = t - h; if (g > 0 && g < dd * 3) o = g < dd ? h : h + (g - dd) * 1.5; }
    return o;
  }
  const h5Frz = (t, hits, d) => { for (const h0 of hits) { const h = Array.isArray(h0) ? h0[0] : h0, dd = Array.isArray(h0) ? h0[1] : d; if (t > h && t < h + dd) return true; } return false; };
  // the view: world → screen
  const V0 = { x: 240, y: 135, z: 1 };
  const vX = (V, x) => (x - V.x) * V.z + 240, vY = (V, y) => (y - V.y) * V.z + 135;

  /* -------------------------------------------------------------- wings */
  const WSTY = {
    nova: { f: [(j, sh) => [110, 105, 109, 110, 104, 109, 105][(j + sh) % 7], () => 109, () => 108], rim: [22, 140, 22], spine: 22 },
    void: { f: [(j, sh) => ((j + sh) % 5 === 0 ? 77 : 0), () => 77, () => 78], rim: [22, 20, 74], spine: 72 },
    hollow: { f: [() => 0, () => 76, () => 77], rim: [72, 71, 102], spine: 71 },
    hvoid: { f: [() => 134, () => 134, () => 134], rim: [22, 20, 22], spine: 78, stars: true, fire: true, wide: 2.4 },
    light: { f: [(j, sh) => [140, 141, 140, 22][(j + sh) % 4], () => 140, () => 22], rim: [22, 141, 141], spine: 22 },
    night: { f: [() => 4, () => 5, () => 6], rim: [56, 56, 57], spine: 57, stars: true },
    ink: { f: [() => 64, () => 64, () => 64], rim: [0, 0, 0], spine: 0 },
    inkd: { f: [() => 0, () => 0, () => 0], rim: [64, 64, 64], spine: 64 },
  };
  function h5Kite(bx, by, a, L, w, c) { z5Kite(bx, by, a, L, w, c); }
  // one wing on screen side sd (−1 left, 1 right) hung from (x, y), the whole thing turned by rot; drag: [vx, vy] of the body
  function h5Wing(x, y, s, t, spread, amp, sd, style, rot, vx, vy, burn) {
    const W_ = WSTY[style]; if (!W_ || spread <= 0.02) return;
    const sh = fl(t * 8), cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
    const R = (px, py) => [x + px * cr - py * sr, y + px * sr + py * cr];
    const fold = clamp((vx || 0) * sd / 900, -0.25, 0.4), sweep = clamp((vy || 0) / 900, -0.45, 0.45), spr = spread * (1 - fold);
    const beat = z5Beat(t) * amp, arm = -0.78 - beat + (1 - spr) * 1.3 + sweep, ax = Math.cos(arm) * sd, ay = Math.sin(arm), Lw = 40 * s * (0.35 + 0.65 * spr);
    const RANKS = [[9, 1, 0], [8, 0.62, 1], [7, 0.36, 2]];
    for (const [N, len, rank] of RANKS) for (let j = N - 1; j >= 0; j--) {
      const u = (j + 0.6) / N, lx = ax * Lw * u, ly = ay * Lw * u - Math.sin(u * PI) * 5 * s, [bx, by] = R(lx, ly);
      const bu = z5Beat(t - 0.12 * u) * amp, fr = lerp(PI / 2 - 0.12, -0.15 - bu * 1.5 + sweep * 0.8, Math.pow(u, 1.25)) - (1 - spr) * 0.5, fa = (sd > 0 ? fr : PI - fr) + (rot || 0);
      const L = s * (15 + 30 * u) * len * (0.45 + 0.55 * spr), w = s * (4.4 - rank * 0.8) * (W_.wide || 1);
      if (burn && ih(j, rank, 7301) < burn) continue;
      h5Kite(bx - Math.cos(fa) * 1.2, by - Math.sin(fa) * 1.2, fa, L + 2.4, w + 1.1, W_.rim[rank]);
      h5Kite(bx, by, fa, L, w, W_.f[rank](j, sh));
      if (rank === 0) lineP(bx, by, bx + Math.cos(fa) * L * 0.8, by + Math.sin(fa) * L * 0.8, W_.spine);
      if (W_.fire && rank === 0) { const tx = bx + Math.cos(fa) * L, ty = by + Math.sin(fa) * L, fh = (3 + 5 * vn(j * 3, t * 6, 1, 7305)) * s; for (let q = 0; q < fh; q++) if (bay(fl(tx), fl(ty - q)) < 1 - q / fh) P(tx + Math.sin(q * 0.7 + t * 9 + j) * 0.8, ty - q, q < fh * 0.4 ? 22 : 20); }
      if (W_.stars && rank < 2) for (let q = 0; q < 2; q++) { const f = 0.25 + ih(j, q + rank * 3, 7302) * 0.6; if (frac(ih(j, q, 7303) + t * 0.7) < 0.7) P(bx + Math.cos(fa) * L * f, by + Math.sin(fa) * L * f, q ? 57 : 22); }
      if (burn && ih(j, rank, 7304) < burn * 1.6) { const tx = bx + Math.cos(fa) * L, ty = by + Math.sin(fa) * L; P(tx, ty, 105); P(tx, ty - 1 - frac(t * 5 + j) * 5, 103); }
    }
  }
  function h5Wings(x, y, s, t, spread, amp, styL, styR, rot, vx, vy, aL, aR) {
    if (styL && (aL === undefined || aL > 0.02)) h5Wing(x, y, s, t, spread * (aL === undefined ? 1 : aL), amp, -1, styL, rot, vx, vy);
    if (styR && (aR === undefined || aR > 0.02)) h5Wing(x, y, s, t, spread * (aR === undefined ? 1 : aR), amp, 1, styR, rot, vx, vy);
  }

  /* -------------------------------------------------------------- the Hollow's inside: stars where its body should be */
  let H5PX = 0, H5PY = 0;                                  // the star field slides with the camera, a little
  function h5Void(t, ink) {
    if (SMB[2] < SMB[0]) return;
    const f = fl(t * 6), ox = fl(H5PX), oy = fl(H5PY);
    for (let y = Math.max(LB, SMB[1]); y <= Math.min(H - LB - 1, SMB[3]); y++) for (let x = Math.max(0, SMB[0]); x <= Math.min(W - 1, SMB[2]); x++) {
      const i = y * W + x; if (BUF[i] !== 134 || !SMASK[i]) continue;
      if (ink) { BUF[i] = 0; continue; }
      const h = ih(x + ox, y + oy, 7001);
      if (h < 0.022) { const tw = ih(x + ox, y + oy, 7002 + f); BUF[i] = h < 0.004 ? (tw < 0.7 ? 22 : 57) : h < 0.012 ? (tw < 0.5 ? 57 : 56) : tw < 0.6 ? 75 : 72; continue; }
      const n = vn(x + ox + t * 3, y + oy, 11, 7003);
      BUF[i] = n > 0.7 ? 78 : n > 0.56 ? 77 : n < 0.25 ? 0 : 134;
    }
  }
  // the ink world: the last stamped sprite in black and paper white (the Hollow's eyes keep their colour)
  function h5InkSprite() { for (let y = Math.max(0, SMB[1]); y <= Math.min(H - 1, SMB[3]); y++) for (let x = Math.max(0, SMB[0]); x <= Math.min(W - 1, SMB[2]); x++) { const i = y * W + x; if (!SMASK[i]) continue; const c = BUF[i]; if ((c >= 72 && c <= 75) || c === 104 || c === 107 || c === 103) continue; BUF[i] = LUMP5[c] > 150 ? 64 : 0; } }
  // darken (or tint) the last stamped sprite
  function h5Tint(T, a) { if (a <= 0.01 || SMB[2] < SMB[0]) return; for (let y = Math.max(0, SMB[1]); y <= Math.min(H - 1, SMB[3]); y++) for (let x = Math.max(0, SMB[0]); x <= Math.min(W - 1, SMB[2]); x++) { const i = y * W + x; if (SMASK[i]) tintI(i, x, y, T, a); } }
  // a sprite-local point on screen
  function h5Loc(p, x, y, S, lx, ly) { if (p.flip) lx = -lx; const c = Math.cos(p.ang), s = Math.sin(p.ang); return [x + (lx * c - ly * s) * S, y + (lx * s + ly * c) * S]; }

  /* -------------------------------------------------------------- slash trails */
  function h5Arc(hx, hy, a0, d, L, fade, sm) {
    const ad = Math.min(Math.abs(d), TAU - 0.05); if (ad < 0.3 || fade >= 1) return;
    const R = L * 1.1, x0 = Math.max(0, fl(hx - R)), x1 = Math.min(W - 1, Math.ceil(hx + R)), y0 = Math.max(LB, fl(hy - R)), y1 = Math.min(H - LB - 1, Math.ceil(hy + R)), two = sm.length > 4;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (SMASK[i]) continue;
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy, r = Math.sqrt(dx * dx + dy * dy);
      if (r > R || r < L * 0.42) continue;
      let rel = Math.atan2(dy, dx) - a0; rel = d > 0 ? ((rel % TAU) + TAU) % TAU : ((-rel % TAU) + TAU) % TAU;
      if (rel > ad) continue;
      const u = rel / ad, rin = L * (1 - 0.52 * Math.pow(u, 1.6)), rout = L * (1.02 + 0.06 * u);
      if (r < rin || r > rout) continue;
      const e = (r - rin) / (rout - rin), b = bay(x, y);
      if (b > u * 1.8 - fade * 1.9) continue;
      const o = two && e < 0.5 ? 4 : 0;
      BUF[i] = (e > 0.8 && u > 0.5) || u > 0.93 ? sm[o + 3] : u > 0.7 ? (e > 0.45 ? sm[o + 2] : sm[o + 1]) : e > 0.55 ? sm[o + 1] : sm[o];
    }
  }
  function h5Trail(keys, tt, hand, S, sm, len) {
    const N = 5, wa = []; let fl0 = null;
    for (let k = 0; k <= N; k++) { const p = h5Pose(keys, tt - k / 30); if (fl0 === null) fl0 = !!p.flip; if (!!p.flip !== fl0 || p.nosw || p.hide) { wa.push(wa.length ? wa[wa.length - 1] : p.wa); continue; } wa.push(p.wa); }
    for (let k = 1; k <= N; k++) { let d = wa[k] - wa[k - 1]; d = Math.atan2(Math.sin(d), Math.cos(d)); wa[k] = wa[k - 1] + d; }     // (unwrapped: a key may reset an angle by a whole turn)
    let m = 0, newest = -1; for (let k = 0; k < N; k++) if (Math.abs(wa[k] - wa[k + 1]) > 0.3) { m = k + 1; if (newest < 0) newest = k; }
    if (!m) return;
    h5Arc(hand[0], hand[1], wa[m], wa[0] - wa[m], (len || 29) * S * 1.03, newest / N * 0.9, sm);
  }

  /* -------------------------------------------------------------- the forms */
  const NOVA_SW = (t) => { const k = fl(t * 14) % 4; return [[108, 140, 108, 109], [140, 108, 109, 108], [108, 109, 108, 140], [109, 108, 140, 108]][k]; };
  const H5FORM = {
    plain: { ghost: [37, 35, 36], smear: [58, 59, 60, 22], eyes: 'normal', swst: 'stub', swl: 9 },
    nova: { sprite: 'nova', eyes: 'glow', wL: 'nova', wR: 'nova', fly: true, aura: [104, 110, 109, 108], auraR: 3, ghost: [22, 109, 110], smear: [110, 109, 108, 22], swc: NOVA_SW, lc: L_WARM, lr: 30, la: 0.32, rimc: 104 },
    hollow: { sprite: 'hollow', eyes: 'narrow', void: true, cold: true, ghost: [78, 72, 102], smear: [78, 0, 0, 74], eyeL: true },
    hnova: { sprite: 'hollownova', eyes: 'narrow', void: true, cold: true, wL: 'hvoid', wR: 'hvoid', ws: 1.35, fly: true, aura: [62, 20, 22, 0], auraR: 3.0, ghost: [22, 0, 78], smear: [77, 0, 20, 22], eyeL: true, lc: L_COLD, lr: 24, la: 0.3, drink: 0.3 },
    dawn: { sprite: 'dawnbreak', eyes: 'glow', void: true, wL: 'night', wR: 'light', fly: true, aura: [110, 141, 140, 22], aura2: [4, 6, 56, 57], auraR: 3, ghost: [22, 56, 141], smear: [141, 140, 22, 22, 139, 138, 138, 56], lc: L_GOLD, lr: 30, la: 0.2, ring: true },
  };
  // the sunrise ring behind Dawnbreak's head: a thin circle of first light, brightest at its top, with a few long rays
  function h5SunRing(x, y, r, t, a) {
    if (a <= 0.02) return;
    for (let q = 0; q < TAU; q += 0.5 / r) { const up = -Math.sin(q), c = up > 0.55 ? 22 : up > -0.1 ? 140 : up > -0.6 ? 141 : 110, px = x + Math.cos(q) * r, py = y + Math.sin(q) * r; if (bay(fl(px), fl(py)) > a * 1.4 + up * 0.3) continue; P(px, py, c); P(x + Math.cos(q) * (r - 1), y + Math.sin(q) * (r - 1), c); if (up > 0.2) P(x + Math.cos(q) * (r + 1), y + Math.sin(q) * (r + 1), up > 0.7 ? 140 : 141); }
    for (let k = 0; k < 12; k++) { const q = -PI / 2 + (k - 5.5) * 0.19 + Math.sin(t * 0.7 + k) * 0.02, L = r * (0.35 + 0.5 * ih(k, 1, 7401)) * a, c = Math.cos(q), s = Math.sin(q); lineF(x + c * (r + 3), y + s * (r + 3), x + c * (r + 3 + L), y + s * (r + 3 + L), (X, Y, u) => { if (bay(X, Y) < 1 - u * 0.8) P(X, Y, u < 0.4 ? 140 : 141); }); }
    light(x, y - r * 0.5, r * 3, L_GOLD, 0.35 * a);
  }
  /* a fighter. base: { form, S, rim: [lx, ly, c], ink (the ink world: line-art versions), noLight }; V the view.
     keys may set: x y a sw reach sq S spread flap flip eyes mouth form nosw hide vib run cr (cracks) dim aur (aura size ×)
     wl wr (wings: sprite-local back / sword side, 0..1) chip (mask) eyeC eyeM arm2 swl swst white alpha clipY lk (legs kicked out) */
  function h5F(keys, tt, base, V) {
    V = V || V0; base = base || {};
    const p = h5Pose(keys, tt); if (p.hide) return null;
    const form = p.form || base.form || 'plain', FM = H5FORM[form], z = V.z, S = (p.S || base.S || 2) * z, t = T_NOW, f = fl(t * 30), ink = base.ink;
    const vib = (p.vib || 0) + (base.frz || 0), jx = vib ? Math.round((ih(f, 3, 601) - 0.5) * 2 * vib) : 0, jy = vib ? Math.round((ih(f, 4, 601) - 0.5) * 2 * vib) : 0;
    const idle = 1 - clamp(p.sp / 220, 0, 1), spread = p.spread === undefined ? (FM.wL ? 1 : 0) : p.spread, winged = !!FM.wL && spread > 0.02;
    const wt = tt * 1.6, fa = p.flap === undefined ? 0.26 : p.flap, bob = (winged ? z5Bob(wt, S, fa) : Math.sin(tt * (FM.cold ? 1.4 : 2.3) + (FM.cold ? 2 : 0)) * 0.5 * S) * idle * (p.nobob ? 0 : 1);
    const x = vX(V, p.x) + jx, y = vY(V, p.y) + jy + bob, ang = p.ang, flip = !!p.flip;
    const dmg = base.dmg ? base.dmg(T_NOW) : 0;
    const gl = (p.glow === undefined ? 1 : p.glow) * (dmg > 0.35 && ih(fl(T_NOW * 30), 7, 7311) < dmg * 0.35 ? 0.35 : 1);
    if (FM.drink && !base.noLight) light(x, y, 46 * S, L_DARK, FM.drink * gl);
    if (FM.ring && !ink) h5SunRing(x - Math.sin(ang) * 3 * S, y - Math.cos(ang) * 3 * S, 15 * S * (p.ringR === undefined ? 1 : p.ringR), t, gl * (p.ring === undefined ? 1 : p.ring));
    if (winged) {
      const wl = p.wl === undefined ? 1 : p.wl, wr = p.wr === undefined ? 1 : p.wr, sL = ink ? (FM.void && form !== 'dawn' ? 'inkd' : 'ink') : FM.wL, sR = ink ? (FM.void && form !== 'dawn' ? 'inkd' : 'ink') : FM.wR;
      h5Wings(x - Math.sin(ang) * 6 * S, y - Math.cos(ang) * 6 * S, S * 0.55 * (p.ws || 1) * (base.ws || FM.ws || 1), wt, spread, fa, flip ? sR : sL, flip ? sL : sR, ang, p.vx * z, p.vy * z, flip ? wr : wl, flip ? wl : wr);
    }
    const after = [];
    if (p.sp > 280 && !p.noAfter && S < 5) for (let k = 1; k <= 3; k++) { const a = h5Trk(keys, tt - k * 0.03); after.push([vX(V, a.x), vY(V, a.y), ink ? (FM.void ? 0 : 143) : FM.ghost[k - 1], 0.62 - k * 0.14]); }
    const lvx = (p.svx * Math.cos(ang) + (p.vy || 0) * Math.sin(ang) * 0.3) * (flip ? -1 : 1), legSh = clamp(-lvx / (60 * (S / z)), -3, 3) + Math.sin(tt * 4.2) * 0.7 * idle * (FM.cold ? 0.3 : 1);
    let legs = [0, 1, 2, 3].map((k) => Math.max(0, Math.sin(tt * 6.5 + k * 1.6)) * 1.2 * idle * (FM.cold ? 0.25 : 1) + ((p.sq || 0) > 0.15 ? 1 : 0));
    if (p.run) { const s = Math.sin(tt * 30); legs = [Math.max(0, s) * 3, Math.max(0, -s) * 3, Math.max(0, -s) * 3, Math.max(0, s) * 3]; }
    if (p.lk) legs = [3 * p.lk, 2 * p.lk, 0, 0];
    if (p.legs) legs = p.legs;
    const hasSw = !p.nosw && typeof p.sw === 'number';
    const o = { who: 'hero', form: FM.sprite, eyes: p.eyes || FM.eyes, mouth: p.mouth, sword: hasSw ? p.sw : undefined, swordCols: FM.swc ? FM.swc(t) : undefined, swordSt: p.swst || FM.swst, swordLen: p.swl || FM.swl,
      sq: (p.sq || 0) + Math.sin(tt * (FM.cold ? 1.9 : 3.1)) * 0.04 * idle, reach: (p.reach || 0), legs, legSh, fly: FM.fly, cracks: Math.max(p.cr || 0, form === 'nova' ? dmg : 0), arm2: p.arm2, armA: p.arm, maskChip: p.chip, eyeC: p.eyeC, eyeM: p.eyeM, mask: p.mask };
    if (ink) { o.outline = FM.void ? 0 : 0; o.swordOut = 0; }
    const res = actor(o, x, y, S, ang, flip, { still: true, after, st: p.st, sd: p.sd, white: p.white, alpha: p.alpha, clipY: p.clipY });
    if (FM.void || form === 'dawn') h5Void(t, ink && form !== 'dawn');
    if (ink) h5InkSprite();
    if (p.dim) h5Tint(T_DARK, p.dim);
    if (base.halo !== undefined) z5Rim(0, 0, null, 0, base.halo);
    if (dmg > 0.05 && !ink) h5Bleed(x, y, S, t, dmg, form === 'nova' ? [109, 105, 22] : [107, 103, 104]);
    if (base.rim && !ink) z5Rim(base.rim[0], base.rim[1], base.rim[2] === undefined ? FM.rimc : base.rim[2], Math.max(1, S * 0.9));
    const aur = p.aur === undefined ? 1 : p.aur;
    if (FM.aura && aur > 0.02 && !ink) aura(t, FM.aura2 && flip ? FM.aura2 : FM.aura, FM.auraR * S * aur, { sparks: 10, cols2: FM.aura2 ? (flip ? FM.aura : FM.aura2) : undefined, splitX: x });
    if (ink) z5Rim(0, 0, null, 0, FM.void && form !== 'dawn' ? 64 : 0);
    else if (form === 'nova') z5Rim(0, 0, null, 0, 102);
    if (FM.lc && !base.noLight && !ink) light(x, y, FM.lr * S, FM.lc, FM.la * gl);
    const len = (p.swl || FM.swl || 30) - 1, tip = [res.hand[0] + Math.cos(p.wa) * len * S, res.hand[1] + Math.sin(p.wa) * len * S];
    if (hasSw) h5Trail(keys, tt, res.hand, S, ink ? (FM.void ? [0, 0, 0, 0] : [143, 0, 0, 0]) : FM.smear, len);
    // the Hollow's eyes leave their light behind when it moves
    if (FM.eyeL && !ink && (p.eyes || FM.eyes) !== 'closed') {
      const e0 = h5Loc(p, x, y, S, -7.5, -2), e1 = h5Loc(p, x, y, S, 7.5, -2);
      if (p.eyeM !== false) light(e0[0], e0[1], 9 * S, L_MAG, 0.5 * gl); if (p.eyeC !== false) light(e1[0], e1[1], 9 * S, L_CRIM, 0.5 * gl);
      if (p.sp > 200) for (let k = 1; k <= 4; k++) { const q = h5Pose(keys, tt - k / 30), qx = vX(V, q.x), qy = vY(V, q.y), a0 = h5Loc(q, qx, qy, S, -7.5, -2), a1 = h5Loc(q, qx, qy, S, 7.5, -2), q2 = h5Pose(keys, tt - (k - 1) / 30), rx = vX(V, q2.x), ry = vY(V, q2.y), b0 = h5Loc(q2, rx, ry, S, -7.5, -2), b1 = h5Loc(q2, rx, ry, S, 7.5, -2);
        if (Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) > 90) break;
        if (p.eyeM !== false) lineF(b0[0], b0[1], a0[0], a0[1], (X, Y) => { if (!SMASK[clamp(Y, 0, H - 1) * W + clamp(X, 0, W - 1)] && bay(X, Y) < 1.1 - k * 0.24) P(X, Y, k < 2 ? 74 : 72); });
        if (p.eyeC !== false) lineF(b1[0], b1[1], a1[0], a1[1], (X, Y) => { if (!SMASK[clamp(Y, 0, H - 1) * W + clamp(X, 0, W - 1)] && bay(X, Y) < 1.1 - k * 0.24) P(X, Y, k < 2 ? 104 : 102); }); }
    }
    return { x, y, S, hand: res.hand, tip, p, wa: p.wa, form, sp: p.sp };
  }
  // ash blowing off a fighter's back: each flake leaves the body where the body was when it was shed (so the stream
  // follows the motion), and drifts on the wind (wx, wy)
  function h5Ash(keys, tt, V, n, wx, wy, cols, life) {
    V = V || V0; life = life || 0.9; cols = cols || [120, 121, 78, 72, 121, 102];
    for (let k = 0; k < n; k++) {
      const age = frac(ih(k, 1, 7501) + tt * (0.9 + ih(k, 2, 7501) * 0.5)) * life, p = h5Trk(keys, tt - age); if (p.hide) continue;
      const S = (p.S || 2) * V.z, x = vX(V, p.x) + (ih(k, 3, 7501) - 0.5) * 24 * S + wx * age + Math.sin(age * 9 + k) * 3, y = vY(V, p.y) + (ih(k, 4, 7501) - 0.6) * 16 * S + wy * age - 14 * age * age;
      if (bay(fl(x), fl(y)) > 1.15 - age / life) continue;
      const big = k % 4 === 0; rectF(x, y, big ? 2 : 1, big ? 2 : 1, cols[k % cols.length]);
    }
  }

  /* -------------------------------------------------------------- hits */
  // an impact frame that keeps a few inks (eyes, the edge of a blade): black and white and one or two colours
  function h5Impact(cx, cy, mode, keep) {
    TMP.set(BUF); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, c = TMP[i]; if (keep && keep.indexOf(c) >= 0) continue; const x2 = x ^ 1, y2 = y ^ 1, l = (LUMP5[c] + LUMP5[TMP[y * W + x2]] + LUMP5[TMP[y2 * W + x]] + LUMP5[TMP[y2 * W + x2]]) / 4; BUF[i] = mode ? (l > 110 ? 0 : 22) : (l > 140 ? 22 : 0); }
    for (let k = 0; k < 44; k++) { const a = ih(k, 1, 81) * TAU, r0 = 34 + ih(k, 2, 81) * 50, w = ih(k, 3, 81) < 0.3; lineF(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * 520, cy + Math.sin(a) * 520, (x, y, u) => { P(x, y, mode ? 22 : 0); if (w && u > 0.15) P(x + 1, y, mode ? 22 : 0); }); }
    LIGHTS.length = 0; GD.bloom = 0; GD.ca = 0; GD.con = 0; GD.vig = 0; GD.flash = 0;
  }
  const LUMP5 = PAL.map((p) => p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15);
  // blade on blade: a cross of light at the contact, sparks thrown both ways across the edges, a ring, a lamp
  function h5Clash(x, y, g, pw, dir, cA, cB, seed) {
    if (g < 0 || g > 0.5) return;
    const f = g / 0.5, ca = Math.cos(dir), sa = Math.sin(dir);
    for (let k = 0; k < 26 * pw; k++) {
      const sd = k & 1 ? 1 : -1, a = dir + sd * PI / 2 + (ih(k, 1, seed) - 0.5) * 1.7, v = (90 + ih(k, 2, seed) * 300) * pw, dd = v * g * (1 - g * 0.8), px = x + Math.cos(a) * dd, py = y + Math.sin(a) * dd + 170 * g * g;
      if (bay(fl(px), fl(py)) > 1.15 - f) continue;
      const tl = 2 + v * 0.03 * (1 - f); lineP(px, py, px - Math.cos(a) * tl, py - Math.sin(a) * tl + 5 * g, k % 3 === 0 ? 22 : sd > 0 ? cA : cB);
    }
    if (g < 0.14) {
      const k = 1 - g / 0.14, L1 = 70 * pw * k, L2 = 34 * pw * k;
      thick(x - ca * L1, y - sa * L1, x + ca * L1, y + sa * L1, k > 0.5 ? 2 : 1, 22);
      thick(x + sa * L2, y - ca * L2, x - sa * L2, y + ca * L2, k > 0.6 ? 2 : 1, 22);
      discF(x, y, 2 + 5 * pw * k, 22);
    }
    if (g < 0.28) shockRing(x, y, 4 + g * 260 * pw, 3 + g * 200 * pw, 2, [22, cA, cB], 1 - g / 0.28);
    light(x, y, 90 * pw * Math.max(0, 1 - g * 3.6), L_WH, 0.7);
    if (g < 0.1) GD.ca = Math.max(GD.ca, 3 * pw * (1 - g / 0.1));
    shk(4 * pw * Math.max(0, 1 - g * 5));
  }
  // a heavy blow: rings, a burst, debris along dir, a lamp in col, fringing, shake; imp: 1 or 2 puts ONE ink frame on it
  function h5Heavy(x, y, g, pw, dir, cols, seed, imp, keep, lcol) {
    if (g < 0 || g > 1.2) return;
    cols = cols || [22, 105, 103]; seed = seed || 1161;
    if (g < 0.5) {
      shockRing(x, y, 8 + g * 420 * pw, 5 + g * 240 * pw, 2 + pw, [22, cols[1], cols[2]], 1 - g / 0.5);
      if (pw >= 2) shockRing(x, y, 4 + g * 260 * pw, 3 + g * 90 * pw, 2, [cols[1], cols[2], cols[2]], 1 - g / 0.45);
      burst(x, y, g / 0.3, 70 * pw, 14 + 4 * pw, ih(fl(x), fl(y), seed) * TAU, [cols[0], cols[1]], 3);
    }
    for (let k = 0; k < 14 + 8 * pw; k++) {
      const a = dir === undefined ? ih(k, 1, seed) * TAU : dir + (ih(k, 1, seed) - 0.5) * 1.5, v = (90 + ih(k, 2, seed) * 260) * Math.sqrt(pw), px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 120 * g * g;
      if (g < 0.6) lineP(px, py, px - Math.cos(a) * (6 + pw * 3), py - Math.sin(a) * (6 + pw * 3), g < 0.15 ? cols[0] : cols[1]);
    }
    light(x, y, 50 * pw * Math.max(0, 1 - g * 2.4), L_WH, 0.6);
    light(x, y, 110 * pw * Math.max(0, 1 - g * 1.4), lcol || L_WARM, 0.4);
    if (g < 0.14) GD.ca = Math.max(GD.ca, 2.2 * pw * (1 - g / 0.14));
    shk(4 * pw * Math.max(0, 1 - g * 2.5));
    if (imp && g < 0.03) h5Impact(x, y, imp === 2 ? 1 : 0, keep);
  }
  // a polygon, filled by scanline (even-odd); fn(x, y) → colour, or -1 to leave the pixel
  function polyF(pts, fn) {
    let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    y0 = Math.max(LB, Math.ceil(y0)); y1 = Math.min(H - LB - 1, fl(y1));
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      xs.length = 0; const py = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > py) !== (b[1] > py)) xs.push(a[0] + (py - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) { const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(W - 1, fl(xs[k + 1] - 0.5)); for (let x = xa; x <= xb; x++) { const c = fn(x, y); if (c >= 0) BUF[y * W + x] = c; } }
    }
  }

  /* -------------------------------------------------------------- the sky is glass
     One fixed tiling of the frame into shards (a Voronoi of jittered points), made once. Cracks are the borders of the
     shards a blow has reached; a breach flings the shards of the old picture out from the blow, each one tumbling and
     shrinking as it goes, still carrying its piece of the world it was broken from. */
  const GN = 64, GSX = new Float32Array(GN), GSY = new Float32Array(GN), GCELL = new Uint8Array(NP), GEDGE = new Uint8Array(NP);
  (function () {
    let k = 0;
    for (let tr = 0; k < GN && tr < 6000; tr++) { const x = ih(tr, 1, 7601) * (W + 40) - 20, y = LB - 10 + ih(tr, 2, 7601) * (H - 2 * LB + 20), md = tr < 3000 ? 40 : 26; let ok = true; for (let q = 0; q < k; q++) if (Math.hypot(GSX[q] - x, GSY[q] - y) < md * (0.6 + ih(q, 3, 7601) * 0.9)) { ok = false; break; } if (ok) { GSX[k] = x; GSY[k] = y; k++; } }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let b = 0, bd = 1e9; for (let q = 0; q < GN; q++) { const dx = x - GSX[q], dy = y - GSY[q], d = dx * dx + dy * dy; if (d < bd) { bd = d; b = q; } } GCELL[y * W + x] = b; }
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) { const i = y * W + x; if (GCELL[i] !== GCELL[i + 1] || GCELL[i] !== GCELL[i + W]) GEDGE[i] = 1; }
  })();
  // cracks spreading from blows: hits = [[x, y, radius now]...]; a shard is cracked once any blow's radius has reached it
  const GACT = new Float32Array(GN);
  function glassAct(hits) { GACT.fill(0); for (const [hx, hy, r] of hits) if (r > 0) for (let q = 0; q < GN; q++) { const d = Math.hypot(GSX[q] - hx, GSY[q] - hy); if (d < r) GACT[q] = Math.max(GACT[q], Math.min(1, (r - d) / 30)); } }
  function glassCracks(hits, c0, c1) {
    glassAct(hits);
    for (let y = LB; y < H - LB - 1; y++) for (let x = 0; x < W - 1; x++) {
      const i = y * W + x; if (!GEDGE[i]) continue;
      const a = Math.max(GACT[GCELL[i]], GACT[GCELL[i + 1]], GACT[GCELL[i + W]]); if (a <= 0 || (a < 1 && bay(x, y) > a)) continue;
      BUF[i] = c0 === undefined ? (a >= 1 && ih(x >> 3, y >> 3, 7612) < 0.45 ? 22 : 135) : c0; if (!GEDGE[i + 1] && a >= 1) BUF[i + 1] = c1 === undefined ? 137 : c1;
    }
  }
  // the view of another world behind chosen shards: pick(q) → a world buffer (or null), amt(q) 0..1 how far it has come through
  function glassWindows(pick, amt, ox, oy) {
    ox = fl(ox || 0); oy = fl(oy || 0);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, q = GCELL[i], a = amt(q); if (a <= 0) continue; const Wv = pick(q); if (!Wv) continue;
      if (a < 1 && bay(x, y) > a * 1.15) continue;
      BUF[i] = GEDGE[i] ? 135 : Wv[clamp(y + oy, LB, H - LB - 1) * W + clamp(x + ox, 0, W - 1)];
    }
  }
  const H5OLD = new Uint8Array(NP), H5NEW = new Uint8Array(NP);
  // a breach: drawOld() paints the picture that breaks; it is flung apart from (cx, cy), g seconds on. o: { v, dur, delay, grav, edge }
  function h5Shatter(drawOld, g, cx, cy, o) {
    o = o || {}; const dur = o.dur || 0.55, delay = o.delay === undefined ? 0.0009 : o.delay, v = o.v || 260, grav = o.grav === undefined ? 120 : o.grav;
    if (g < 0 || g > dur + delay * 560) return;
    H5NEW.set(BUF); const nl = LIGHTS.length; drawOld(); LIGHTS.length = nl; H5OLD.set(BUF); BUF.set(H5NEW);
    const U = [], OX = [], OY = [], SXc = [], SYc = [];
    for (let q = 0; q < GN; q++) {
      const dx = GSX[q] - cx, dy = GSY[q] - cy, d = Math.hypot(dx, dy) || 1, u = clamp((g - d * delay) / dur, 0, 1), e = u * (2 - u), sp = v * (0.6 + ih(q, 1, 7621) * 0.9);
      U.push(u); OX.push(dx / d * sp * e * dur + (ih(q, 2, 7621) - 0.5) * 40 * e); OY.push(dy / d * sp * e * dur + grav * u * u + (ih(q, 3, 7621) - 0.5) * 30 * e);
      const sc = 1 - 0.75 * u * u; SXc.push(sc * Math.cos(u * (2 + ih(q, 4, 7621) * 5))); SYc.push(sc * (0.6 + 0.4 * Math.cos(u * (1 + ih(q, 5, 7621) * 4))));
    }
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, q = GCELL[i], u = U[q];
      if (u >= 1) continue;
      if (u <= 0) { BUF[i] = GEDGE[i] && g > 0 ? 22 : H5OLD[i]; continue; }
      const X = fl(GSX[q] + (x - GSX[q]) * SXc[q] + OX[q]), Y = fl(GSY[q] + (y - GSY[q]) * SYc[q] + OY[q]);
      if (X < 0 || X >= W || Y < LB || Y >= H - LB) continue;
      if (u > 0.6 && bay(X, Y) < (u - 0.6) * 2.5) continue;
      BUF[Y * W + X] = GEDGE[i] ? (SXc[q] > 0 ? 22 : 135) : SXc[q] < 0 ? T_DARK[3][H5OLD[i]] : H5OLD[i];
    }
  }
  // the worlds behind the glass, each painted once and kept (so a shard can carry a view of it)
  const WV = {};
  function wview(name) {
    if (WV[name]) return WV[name];
    const keep = BUF.slice(), nl = LIGHTS.length, gd = Object.assign({}, GD);
    BUF.fill(0); WORLDS[name](); const b = BUF.slice(); BUF.set(keep); LIGHTS.length = nl; Object.assign(GD, gd);
    return (WV[name] = b);
  }
  // a shard of sky: a sliver of glass with a piece of a world in it. pts: polygon (screen); view: world name; (ax, ay): which
  // part of that world it carries; th: its thickness (a slab seen a little from below)
  function h5Shard(pts, view, ax, ay, t, o) {
    o = o || {}; const Wv = typeof view === 'string' ? wview(view) : view, th = o.th || 0, n = pts.length;
    let cx = 0, cy = 0; for (const p of pts) { cx += p[0] / n; cy += p[1] / n; }
    if (th) polyF(pts.map((p) => [p[0] + (o.thx || 0), p[1] + th]), (x, y) => (((x + y) >> 1) & 3) === 0 ? 136 : (y & 1) ? 137 : 116);
    const sx = fl(ax - cx), sy = fl(ay - cy), dimT = o.dim || 0, ph = (o.seed || 0) * 13.7 + t * 0.35;
    polyF(pts, (x, y) => {
      const c = Wv[clamp(y + sy, LB, H - LB - 1) * W + clamp(x + sx, 0, W - 1)];
      const band = frac((x + y * 0.8) / 46 + ph); if (band < 0.035 || (band > 0.09 && band < 0.105)) return bay(x, y) < 0.6 ? 135 : c;
      return dimT && bay(x, y) < dimT ? T_DARK[4][c] : c;
    });
    // the bevel: edges facing the light (up and to the left) catch it
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = pts[j], b = pts[i], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey) || 1; let nx = ey / L, ny = -ex / L; if ((a[0] + b[0]) / 2 * nx + (a[1] + b[1]) / 2 * ny < cx * nx + cy * ny) { nx = -nx; ny = -ny; }
      const lit = -ny * 0.8 - nx * 0.5; lineP(a[0], a[1], b[0], b[1], lit > 0.35 ? 22 : lit > -0.2 ? 135 : 137);
    }
    if (o.glint !== false) { const k = fl(t * 2.5 + (o.seed || 0)), v = pts[(k * 7 + (o.seed || 0)) % n], tw = frac(t * 2.5 + (o.seed || 0)); if (ih(k, o.seed || 0, 7631) < 0.4) sparkle(v[0], v[1], 5 * Math.sin(tw * PI), 22, 135); }
  }
  // an irregular shard outline about (cx, cy): rx, ry radii, rot, seed, n corners
  function shardPts(cx, cy, rx, ry, rot, seed, n) {
    n = n || 6; const pts = [], c = Math.cos(rot), s = Math.sin(rot);
    for (let k = 0; k < n; k++) { const a = (k + ih(k, seed, 7641) * 0.7) / n * TAU, r = 0.62 + ih(k, seed, 7642) * 0.38, px = Math.cos(a) * rx * r, py = Math.sin(a) * ry * r; pts.push([cx + px * c - py * s, cy + px * s + py * c]); }
    return pts;
  }
  // a platform shard: flat on top (from x0 to x1 at y, tilted by rot about its middle), a keel of broken glass under it
  function slabPts(x0, x1, y, rot, depth, seed) {
    const mx = (x0 + x1) / 2, hw = (x1 - x0) / 2, c = Math.cos(rot), s = Math.sin(rot), R = (px, py) => [mx + px * c - py * s, y + px * s + py * c];
    return [R(-hw, 0), R(hw, 0), R(hw * (0.72 + ih(seed, 1, 7651) * 0.2), depth * 0.45), R(hw * (0.1 + ih(seed, 2, 7651) * 0.4), depth), R(-hw * (0.3 + ih(seed, 3, 7651) * 0.4), depth * 0.7), R(-hw * 0.86, depth * 0.3)];
  }
  // ash drawn in along curved paths from the frame's edges to (tx, ty): n flakes, amt 0..1 how thick the stream is
  function ashStreams(t, tx, ty, n, amt, seed) {
    for (let k = 0; k < n; k++) {
      if (ih(k, 9, seed) > amt) continue;
      const side = k % 4, e = ih(k, 1, seed), sx = side === 0 ? -10 : side === 1 ? W + 10 : e * W, sy = side < 2 ? LB + e * (H - 2 * LB) : side === 2 ? LB - 8 : H - LB + 8;
      // flakes travel in ribbons: each belongs to one of a dozen streams and keeps near its curve
      const rb = k % 14, bend = (ih(rb, 4, seed) - 0.5) * 260, sp = 0.3 + ih(k, 2, seed) * 0.35, u0 = frac(ih(k, 3, seed) + t * sp), bx = side === 0 ? -10 : side === 1 ? W + 10 : ih(rb, 5, seed) * W, by = side < 2 ? LB + ih(rb, 6, seed) * (H - 2 * LB) : sy;
      const ax = lerp(sx, bx, 0.7), ay = lerp(sy, by, 0.7), mx = (ax + tx) / 2 + (ty - ay) / 300 * bend, my = (ay + ty) / 2 - (tx - ax) / 300 * bend - 24;
      const big = k % 3 === 0, c = k % 9 === 0 ? 72 : k % 9 === 4 ? 102 : k % 4 === 0 ? 121 : k % 4 === 1 ? 120 : 0;
      for (let q = 0; q < 7; q++) {
        const u = u0 - q * 0.009; if (u < 0) continue; const e2 = u * u * (3 - 2 * u), x = z5Bz(ax, mx, tx, e2) + Math.sin(u * 20 + k) * 4 * (1 - u), y = z5Bz(ay, my, ty, e2) + Math.cos(u * 17 + k) * 3 * (1 - u);
        if (bay(fl(x), fl(y)) > 1.25 - q * 0.17) continue;
        if (q === 0 && big) rectF(x, y, 2, 2, c); else P(x, y, q > 3 ? 120 : c);
      }
    }
  }
  const WORLDS = {};
  const clip01 = (a, b, t) => clamp((t - a) / (b - a), 0, 1);

  /* ================================================================ part V: the worlds behind the sky
     Each is drawn its own way and in its own colours: the dawn above the cloud (paint), the ocean hanging overhead with
     its teeth (cold teal), the white void (black ink line, boiling like a drawing), the folded city (teal night, amber
     windows), the cathedral inside the dead sun (obsidian and dark fire), the night between the halves (indigo, a moon),
     and the world as Dawnbreak sees it: black, drawn in lines of light, with a burning horizon. */
  const SKY5 = [3, 4, 5, 6, 7, 133, 132, 130, 131, 15, 16];
  // the dawn above the cloud sea: hz the horizon, ox a drift; the sun at (sunX, sunY)
  function w5Dawn(t, ox, hz, sunX, sunY, o) {
    o = o || {};
    gradient(LB, hz + 6, SKY5);
    for (let k = 0; k < 46; k++) { const x = ih(k, 1, 8001) * W, y = LB + ih(k, 2, 8001) * 62, tw = frac(ih(k, 3, 8001) + t * 0.5); if (tw < 0.75) P(x, y, y < LB + 30 && tw < 0.2 ? 21 : 19); }
    // high cirrus, lit rose from under
    for (let k = 0; k < 10; k++) {
      const y0 = LB + 16 + ih(k, 1, 8002) * 86, L = 70 + ih(k, 2, 8002) * 150, x0 = ((ih(k, 3, 8002) * 760 - ox * (0.12 + 0.1 * ih(k, 4, 8002)) - t * 2) % 760 + 760) % 760 - 180, th = 2 + fl(ih(k, 5, 8002) * 3);
      for (let q = 0; q < th; q++) for (let x = 0; x < L; x++) { const u = x / L, e = Math.sin(u * PI), yy = y0 + q + Math.sin(x * 0.05 + k) * 2; if (bay(fl(x0 + x), fl(yy)) < e * (0.75 - q * 0.12) * (0.5 + 0.5 * vn(x0 + x + ox * 0.1, k * 9, 14, 8003))) P(x0 + x, yy, q === th - 1 ? (y0 > LB + 70 ? 131 : 130) : y0 > LB + 60 ? 132 : 133); }
    }
    const sk = o.sunR || 1;
    light(sunX, sunY, 200 * sk, L_WARM, 0.5);
    discF(sunX, sunY, 22 * sk, 15); discF(sunX, sunY, 18 * sk, 16); discF(sunX - 4 * sk, sunY - 4 * sk, 9 * sk, 22);
    z5GodRays(sunX, sunY, 7, t * 0.15, T_WARM, 0.42, 380);
    cloudBank(hz + 8, 22, 80, 5051, ox * 0.5, CLOUD_SUN, false);
    if (!o.noNear) cloudBank(hz + 44, 30, 60, 5052, ox, CLOUD_NEAR, false);
  }
  // the first world behind the sky: the dark ocean hangs overhead, upside down, its rock spires pointing down like teeth.
  // oy: how far the camera has fallen (the teeth slide up past it); o.hole: [x, amt] the breach they fell through, o.lx: light
  const TEAL = [124, 125, 126, 127, 128, 129];
  function w5Ocean(t, ox, oy, o) {
    o = o || {}; oy = oy || 0;
    const top = LB, bot = H - LB, HZs = LB + 66 - Math.min(20, oy * 0.03), hz = top + bot - HZs, LX = o.lx === undefined ? 250 : o.lx;   // (drawn upright, then turned over)
    gradient(top, hz + 2, [114, 114, 124, 114, 124, 115, 124, 115, 125, 116]);
    for (let k = 0; k < 70; k++) { const x = ((ih(k, 1, 8101) * W - ox * 0.03) % W + W) % W, y = top + ih(k, 2, 8101) * (hz - top - 50), tw = frac(ih(k, 3, 8101) + t * 0.4); if (tw < 0.6) P(x, y, tw < 0.1 ? 119 : 117); }
    for (let y = fl(hz); y < bot; y++) {
      const u = (y - hz) / Math.max(1, bot - hz), base = fl(u * 3.2);
      for (let x = 0; x < W; x++) {
        const wx = x + ox * (0.2 + u), sw = Math.sin(wx * 0.05 / (0.2 + u) + t * 1.2 + y * 0.9) + Math.sin(wx * 0.013 / (0.2 + u) - t * 0.7 + y * 0.31);
        let c = OCEAN[clamp(base + (sw > 1.2 ? 2 : sw > 0.6 ? 1 : 0) - (bay(x, y) > 0.5 + u * 0.4 ? 1 : 0), 0, 3)];
        if (sw > 1.75 && u > 0.1) c = u > 0.5 ? 119 : 118;
        const rw = 10 + u * 60, dxr = Math.abs(x - LX - Math.sin(y * 0.7 + t * 2) * (2 + u * 6));
        if (dxr < rw && sw > 0.3 - (1 - dxr / rw) * 0.9 && ih(x >> 1, y, fl(t * 8)) < 0.8) c = sw > 1.2 ? 135 : sw > 0.7 ? 119 : 118;
        BUF[y * W + x] = c;
      }
    }
    for (let layer = 0; layer < 3; layer++) {
      const n = 8 - layer * 2, par = 0.25 + layer * 0.45, sc = 0.55 + layer * 0.6, vp = 0.12 + layer * 0.22;
      const LIT = layer === 0 ? [125, 126, 116] : layer === 1 ? [125, 126, 127] : [124, 126, 127], SH = layer === 0 ? 115 : layer === 1 ? 124 : 114, INK = layer === 2 ? 0 : 114;
      for (let k = 0; k < n; k++) {
        const bx = ((ih(k, layer, 8102) * 660 - ox * par) % 660 + 660) % 660 - 90, bw = (13 + ih(k, 2, 8102 + layer) * 22) * sc, bh = (60 + ih(k, 3, 8102 + layer) * 110) * sc, by = hz + 5 + layer * 16 + oy * vp;
        const lean = (ih(k, 4, 8102 + layer) - 0.5) * 0.22, rdg = (ih(k, 5, 8102 + layer) - 0.5) * 0.5;
        for (let y = fl(by - bh); y < by + 3; y++) {
          if (y < top || y >= bot) continue;
          const v = (by - y) / bh, cxr = bx + lean * (by - y) + Math.sin(v * 5 + k) * 2 * sc, half = bw * Math.pow(Math.max(0, 1 - v), 0.85) * (0.82 + 0.36 * vn(y * 0.2, k, 1, 8103 + layer)) + 0.4;
          for (let x = fl(cxr - half); x <= cxr + half; x++) {
            if (x < 0 || x >= W) continue;
            const f = (x - cxr) / half, onLit = f < rdg * (1 - v), strata = frac((y + vn(x * 0.2, k, 1, 8104) * 3) / (7 * sc)) < 0.14;
            let c = onLit ? LIT[f < -0.7 ? 2 : f < -0.25 ? 1 : 0] : SH;
            if (strata) c = onLit ? LIT[0] : INK;
            if (Math.abs(f) > 0.9) c = INK;
            if (v > 0.9 && onLit && bay(x, y) < 0.5) c = 127;                                 // wet tips catching what light there is
            if (layer > 0 && ((v > 0.93 && Math.abs(f) < 0.7) || (onLit && ih(x, y, 8115 + fl(t * 2)) < 0.025 * layer) || (Math.abs(f - Math.sin(v * 9 + k) * 0.35) < 0.07 && v > 0.45 && bay(x, y) < 0.6))) c = v > 0.96 ? 129 : 128;   // bioluminescence
            BUF[y * W + x] = c;
          }
        }
        for (let q = 0; q < 5; q++) { const mx = bx + (ih(k, q, 8105 + layer) - 0.5) * bw * 2.2, my = by + 1 + Math.sin(t * 0.8 + q + k) * 1.5; cloudPuff(mx, my, (5 + q) * sc, [115, 116, 117, 118], 8106 + k * 7 + q); }
      }
    }
    // the glowing tips of the teeth, lamps for the grade (in the turned-over picture)
    for (let layer = 1; layer < 3; layer++) { const n = 8 - layer * 2, par = 0.25 + layer * 0.45, sc = 0.55 + layer * 0.6, vp = 0.12 + layer * 0.22; for (let k = 0; k < n; k++) { const bx = ((ih(k, layer, 8102) * 660 - ox * par) % 660 + 660) % 660 - 90, bh = (60 + ih(k, 3, 8102 + layer) * 110) * sc, by = hz + 5 + layer * 16 + oy * vp, ty = top + bot - 1 - (by - bh), lean = (ih(k, 4, 8102 + layer) - 0.5) * 0.22; light(bx + lean * bh, ty, 26 * sc, [0.35, 1, 0.85], 0.32 + 0.12 * Math.sin(t * 2 + k)); } }
    // turn it over
    for (let y = 0; y < (bot - top) >> 1; y++) { const a = (top + y) * W, b = (bot - 1 - y) * W; for (let x = 0; x < W; x++) { const c = BUF[a + x]; BUF[a + x] = BUF[b + x]; BUF[b + x] = c; } }
    // far below: a second sea, of mist; and far off in the dark, teeth the size of mountains
    for (let k = 0; k < 6; k++) {
      const bx = ((ih(k, 1, 8110) * 760 - ox * 0.1) % 760 + 760) % 760 - 140, bw = 34 + ih(k, 2, 8110) * 50, bh = 130 + ih(k, 3, 8110) * 70 - Math.min(40, oy * 0.02), y0 = HZs + 4;
      for (let y = fl(y0); y < Math.min(bot, y0 + bh); y++) { const v = (y - y0) / bh, half = bw * Math.pow(1 - v, 0.9) * (0.85 + 0.3 * vn(y * 0.1, k, 1, 8111)); for (let x = fl(bx - half); x <= bx + half; x++) { if (x < 0 || x >= W) continue; const i = y * W + x, c0 = BUF[i]; if (c0 > 1 && c0 !== 114 && c0 !== 117 && c0 !== 119 && c0 !== 124 && c0 !== 115) continue; const f = (x - bx) / half; if (bay(x, y) > 1.3 - v * 0.9) continue; BUF[i] = f < -0.55 ? 126 : f < -0.2 ? (bay(x, y) < 0.5 ? 125 : 115) : f > 0.6 ? 114 : 115; } }
    }
    cloudBank(bot - 16 + Math.max(0, 30 - oy * 0.05), 30, 110, 8112, ox * 0.18 + t * 3, [114, 124, 115, 125], true);
    cloudBank(bot + 6 + Math.max(0, 30 - oy * 0.05), 30, 70, 8113, ox * 0.35 + t * 5, [1, 114, 124, 115], true);
    for (let q = 0; q < 5; q++) light(LX - 60 + q * 22, HZs + 20 + q * 34, 60 + q * 10, L_COLD, 0.13);
    for (let k = 0; k < 44; k++) { const dp = 0.3 + ih(k, 1, 8114) * 0.9, x = ((ih(k, 2, 8114) * 560 - ox * dp * 0.6) % 560 + 560) % 560 - 40, y = bot - frac(ih(k, 3, 8114) + oy * dp / 260) * (bot - top + 40) + 20, L = (5 + ih(k, 4, 8114) * 18) * dp; for (let q = 0; q < L; q++) if (bay(fl(x), fl(y + q)) < 0.55 - q / L * 0.4) P(x, y + q, dp > 0.8 ? 116 : 115); }
    // water letting go of the teeth, falling away into the dark below
    for (let k = 0; k < 26; k++) { const x = ((ih(k, 1, 8107) * 560 - ox * (0.3 + 0.5 * ih(k, 2, 8107))) % 560 + 560) % 560 - 40, u = frac(ih(k, 3, 8107) + t * (0.5 + ih(k, 4, 8107) * 0.5)), y = HZs + 20 + u * u * 190 - oy * 0.2 % 40, L = 3 + u * 9; for (let q = 0; q < L; q++) if (bay(fl(x), fl(y - q)) < 0.7 - q / L * 0.5) P(x, y - q, q < 2 ? 118 : 117); }
    // light down the abyss: soft shafts from the sea-sky; lines of glowing foam on the mist below; drifting motes
    z5GodRays(LX, top, 9, t * 0.05, T_CYAN, 0.16, 330);
    for (let k = 0; k < 7; k++) { const y0 = bot - 50 + k * 7 + Math.max(0, 30 - oy * 0.05) * 0.5, sp = 10 + k * 6; for (let x = 0; x < W; x++) { const wx = x + ox * (0.2 + k * 0.05) + t * sp, n = vn(wx, k * 13, 22 + k * 4, 8116); if (n < 0.58) continue; const y = y0 + Math.sin(wx * 0.06 + t * 1.3 + k) * (1.5 + k * 0.4); if (y < bot && bay(x, fl(y)) < (n - 0.58) * 4) P(x, y, n > 0.72 ? 129 : 128); } }
    for (let k = 0; k < 34; k++) { const dp = 0.4 + ih(k, 1, 8117) * 0.8, x = ((ih(k, 2, 8117) * 560 - ox * dp * 0.5 + Math.sin(t * 0.7 + k) * 8) % 560 + 560) % 560 - 40, y = HZs + 30 + ih(k, 3, 8117) * (bot - HZs - 40) + Math.sin(t * 0.9 + k * 1.3) * 5 - oy * dp * 0.04 % 30, tw = 0.5 + 0.5 * Math.sin(t * 3 + k); P(x, y, tw > 0.5 ? 129 : 128); if (dp > 0.9) { P(x + 1, y, 128); P(x, y + 1, 128); } if (k % 4 === 0) light(x, y, 12 * dp, [0.35, 1, 0.85], 0.25 * tw); }
    // the breach: the hole in the sea-sky they fell through, dawn pouring down it
    if (o.hole) {
      const [hx, a] = o.hole, hy = top + 12, Wd = wview('dawn');
      for (let y = top; y < hy + 16; y++) for (let x = fl(hx - 46); x < hx + 46; x++) { if (x < 0 || x >= W) continue; const dx = (x - hx) / 44, dy = (y - hy) / 15, d = dx * dx + dy * dy + (vn(x, y, 6, 8108) - 0.5) * 0.5; if (d > a) continue; BUF[y * W + x] = d > a - 0.14 ? 22 : d > a - 0.24 ? 135 : Wd[clamp(y + 70, LB, H - LB - 1) * W + x]; }
      for (let q = 0; q < 6; q++) light(hx + q * 5, hy + q * 30, 70 + q * 14, L_WARM, 0.22 * a * (1 - q / 7));
    }
    light(LX, HZs, 130, L_COLD, 0.25);
  }
  // the white void: paper, and everything on it a black ink line that boils like a drawing
  function w5Ink(t, ox, oy, o) {
    o = o || {}; ox = ox || 0; oy = oy || 0;
    const top = LB, bot = H - LB, boil = fl(t * 8);
    for (let y = top; y < bot; y++) for (let x = 0; x < W; x++) { const n = vn(x + ox * 0.1, y, 46, 8201) + vn(x, y, 3, 8202) * 0.12; BUF[y * W + x] = n > 0.68 ? (bay(x, y) < (n - 0.68) * 5 ? 143 : 142) : n > 0.56 && bay(x, y) < 0.4 ? 142 : 64; }
    const jit = (k, a) => (ih(k, boil, 8203) - 0.5) * a;
    // the ink sun: rough rings, strokes around it
    const sx = 352 - ox * 0.04, sy = 96 - oy * 0.05;
    for (let r = 0; r < 3; r++) { const R = 44 - r * 9; for (let a = 0; a < TAU; a += 0.5 / R) { if (r && ih(fl(a * 5), r + boil, 8204) < 0.3) continue; const rr = R + (vn(a * 4, boil, 1, 8205 + r) - 0.5) * 3; P(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr, 0); if (r === 0) P(sx + Math.cos(a) * (rr + 1), sy + Math.sin(a) * (rr + 1), 0); } }
    for (let k = 0; k < 22; k++) { const a = k / 22 * TAU + jit(k, 0.04), r0 = 52 + (k % 3) * 4, r1 = r0 + 8 + ih(k, 1, 8206) * 22; lineP(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0, sx + Math.cos(a) * r1, sy + Math.sin(a) * r1, 0); }
    // two ranges of mountains: an outline, hatching on the far slopes
    for (let L = 0; L < 2; L++) {
      const yb = L ? 206 : 168, hh = L ? 74 : 52, par = L ? 0.4 : 0.16, sd = 8210 + L * 7; let py = 0;
      for (let x = 0; x < W; x++) {
        const wx = x + ox * par, f = fbm(wx, 0, L ? 70 : 110, 4, sd), y = fl(yb - hh * f - oy * par * 0.3 + (vn(wx, boil, 3, sd + 1) - 0.5) * 1.2), up = fbm(wx + 2, 0, L ? 70 : 110, 4, sd) > f;
        for (let yy = Math.max(top, y); yy < bot; yy++) BUF[yy * W + x] = 64;
        if (x) for (let yy = Math.min(y, py); yy <= Math.max(y, py); yy++) { P(x, yy, 0); if (L) P(x, yy + 1, 0); }
        py = y;
        if (!up && (fl(wx) % (L ? 3 : 4)) === 0) { const hl = (6 + ih(fl(wx), 1, sd + 2) * (L ? 30 : 16)); for (let q = 2; q < hl; q++) if (bay(x, y + q) < 1 - q / hl) P(x + (L ? q * 0.4 : 0), y + q, 0); }
        if (L && ih(fl(wx), 3, sd + 3) < 0.012) { const th = 8 + ih(fl(wx), 4, sd) * 12; lineP(x, y, x + jit(x, 1), y - th, 0); for (let b = 0; b < 4; b++) lineP(x, y - th * (0.4 + b * 0.15), x + (b & 1 ? 4 : -4) + jit(x + b, 1), y - th * (0.55 + b * 0.15) - 2, 0); }   // a bare tree
      }
    }
    // curls of cloud, birds, spatters
    for (let k = 0; k < 5; k++) { const cx = ((ih(k, 1, 8220) * 640 - ox * 0.22 - t * 5) % 640 + 640) % 640 - 80, cy = 58 + ih(k, 2, 8220) * 50 - oy * 0.06; for (let a = 0.6; a < 8; a += 0.07) { const r = a * 2.1; P(cx + Math.cos(a + jit(k, 0.1)) * r * 1.7, cy + Math.sin(a) * r, 0); } for (let x = 0; x < 50; x++) if (bay(fl(cx + 22 + x), fl(cy + 15)) < 1 - x / 50) { P(cx + 22 + x, cy + 15 + Math.sin(x * 0.2) * 1.5, 0); P(cx - 60 + x, cy + 12 - Math.sin(x * 0.15) * 2, 0); } }
    for (let k = 0; k < 6; k++) { const bx = ((ih(k, 1, 8221) * 560 - ox * 0.3 + t * 14) % 560 + 560) % 560 - 40, by = 50 + ih(k, 2, 8221) * 40, fp = Math.sin(t * 9 + k) * 2; lineP(bx - 4, by - fp, bx, by, 0); lineP(bx, by, bx + 4, by - fp, 0); }
    for (let k = 0; k < 26; k++) { const x = ((ih(k, 1, 8222) * 600 - ox * 0.7) % 600 + 600) % 600 - 60, y = top + ih(k, 2, 8222) * (bot - top), r = ih(k, 3, 8222) * 2.4; discF(x, y, r, 0); if (k % 5 === 0) for (let q = 0; q < 14; q++) if (bay(fl(x), fl(y + q)) < 1 - q / 14) P(x, y + q, 0); }
    // reeds, close to the lens
    for (let k = 0; k < 16; k++) { const x = ((ih(k, 1, 8223) * 620 - ox * 1.25) % 620 + 620) % 620 - 70, h = 26 + ih(k, 2, 8223) * 44, bend = (ih(k, 3, 8223) - 0.5) * 30 + Math.sin(t * 2 + k) * 3; for (let q = 0; q < h; q++) { const u = q / h, px = x + bend * u * u, py = bot + 4 - q + oy * 0.2; P(px, py, 0); if (u < 0.6) P(px + 1, py, 0); if (u > 0.85 && k % 3 === 0) { P(px - 1, py, 0); P(px + 2, py, 0); } } }
  }
  // the staircase city folded over itself: towers stand up from below, hang from above, and jut from the sides; great
  // flights of stairs cross between them, some the wrong way up; lit windows
  function w5Tower(x, y, w, h, dir, cols, k, t, win, horiz) {
    const R = horiz ? (a, b, cw, ch, c) => rectF(b, a, ch, cw, c) : rectF, PP = horiz ? (a, b, c) => P(b, a, c) : P;
    const y0 = dir < 0 ? y - h : y, sh = Math.max(2, fl(w * 0.28));
    R(x, y0, w, h, cols[0]); R(x + w - sh, y0, sh, h, cols[1]);
    for (let q = 0; q < h; q += 9) R(x, y0 + q, w, 1, cols[1]);
    const cap = dir < 0 ? y0 : y0 + h, cw = fl(w * 0.6), ch = 4 + (k % 3) * 3;
    R(x + (w - cw) / 2, dir < 0 ? cap - ch : cap, cw, ch, cols[0]); R(x + w / 2 - 1, dir < 0 ? cap - ch - 7 : cap + ch, 1, 7, cols[1]);
    for (let wy = 3; wy < h - 4; wy += 5) for (let wx = 2; wx < w - sh - 2; wx += 4) { const r = ih(k * 31 + wx, wy, 8301) * 0.72; if (r < 0.34) { const fk = r < 0.03 && fl(t * 6 + k) % 3 === 0; if (!fk) { R(x + wx, y0 + wy, 2, 3, r < 0.12 ? win[1] : win[0]); if (r < 0.06) PP(x + wx, y0 + wy, win[2]); } } }
    // a stair zigzagging up its face
    if (k % 2 === 0 && w > 16) for (let q = 0; q < h - 6; q++) { const z = fl(q / 8), f = (q % 8) / 8, xx = x + 2 + (z & 1 ? 1 - f : f) * (w - sh - 5); PP(xx, y0 + (dir < 0 ? h - 2 - q : q + 1), cols[2]); }
  }
  // a flight of stairs from (x0, y0) to (x1, y1): treads lit on top, a rail with lamps; under: it is the wrong way up
  function w5Flight(x0, y0, x1, y1, sw, cols, under, t, seed, lamp) {
    const n = Math.max(2, Math.round(Math.abs(x1 - x0) / sw)), dx = (x1 - x0) / n, dy = (y1 - y0) / n, u = under ? -1 : 1, thk = 5;
    for (let s = 0; s < n; s++) {
      const x = x0 + dx * s, y = y0 + dy * s, xa = Math.min(x, x + dx), w = Math.abs(dx) + 1, hgt = Math.abs(dy);
      rectF(xa, under ? y - thk - hgt : y, w, thk + hgt + 1, cols[0]);
      rectF(xa, under ? y : y, w, 1, under ? cols[2] : cols[2]); if (!under) rectF(xa, y + 1, w, 1, cols[1]);
      if (dy * u < 0) rectF(dx > 0 ? x + dx : x, Math.min(y, y + dy), 1, hgt, cols[1]);
      if (s % 3 === 0) { const px = x + dx / 2; lineP(px, y - u, px, y - u * 9, cols[1]); }
      if (lamp && s % 5 === 2) { const px = x + dx / 2, py = y - u * 11; P(px, py, 22); P(px - 1, py, 15); P(px + 1, py, 15); P(px, py + u, 15); light(px, py, 30, L_WARM, 0.6); }
    }
    lineP(x0, y0 - u * 9, x1, y1 - u * 9, cols[1]);
  }
  function w5City(t, ox, oy, o) {
    o = o || {}; ox = ox || 0; oy = oy || 0;
    const top = LB, bot = H - LB;
    gradient(top, bot, [124, 125, 126, 127, 126, 125, 124]);
    light(240 - ox * 0.05, 135, 190, L_COLD, 0.2);
    for (let k = 0; k < 40; k++) { const x = ih(k, 1, 8310) * W, y = top + ih(k, 2, 8310) * (bot - top); if (frac(ih(k, 3, 8310) + t * 0.3) < 0.5) P(x, y, 128); }
    for (let layer = 0; layer < 2; layer++) {
      const par = 0.2 + layer * 0.35, cols = layer ? [124, 114, 126] : [125, 124, 126], win = layer ? [15, 16, 22] : [141, 15, 16], sc = 0.7 + layer * 0.5;
      // from the sides (the far layer only): the city on the walls of the fold
      if (!layer) for (let k = 0; k < 7; k++) { const yy = top + 10 + k * 27 + ((oy * 0.2) % 27), w = 14 + ih(k, 1, 8320) * 16, h = 30 + ih(k, 2, 8320) * 60; w5Tower(yy, 0, w, h, 1, [126, 125, 127], k + 60, t, [141, 15, 16], true); w5Tower(yy + 9, W, w, h * 0.9, -1, [126, 125, 127], k + 80, t, [141, 15, 16], true); }
      for (let k = 0; k < 13; k++) {
        const x = ((ih(k, layer, 8321) * 720 - ox * par) % 720 + 720) % 720 - 80, w = (16 + ih(k, 2, 8321 + layer) * 28) * sc, h = (36 + ih(k, 3, 8321 + layer) * 86) * sc;
        w5Tower(x, bot + 6 - oy * par * 0.6 + (layer ? 0 : -14), w, h, -1, cols, k + layer * 20, t, win);
        const x2 = ((ih(k, layer + 5, 8322) * 720 - ox * par * 1.1) % 720 + 720) % 720 - 80, h2 = (30 + ih(k, 4, 8322 + layer) * 80) * sc;
        w5Tower(x2, top - 6 - oy * par * 0.6 + (layer ? 0 : 12), w, h2, 1, cols, k + 40 + layer * 20, t, win);
      }
      if (!layer) { w5Flight(520 - ox * 0.3, 232 - oy * 0.2, 150 - ox * 0.3, 52 - oy * 0.2, 7, [125, 124, 127], false, t, 1, false); w5Flight(-60 - ox * 0.3, 60 - oy * 0.2, 330 - ox * 0.3, 210 - oy * 0.2, 7, [125, 124, 127], true, t, 2, false); for (let y = top; y < bot; y++) for (let x = 0; x < W; x++) if (bay(x, y) < 0.22) { const i = y * W + x; if (BUF[i] !== 15 && BUF[i] !== 16 && BUF[i] !== 141) BUF[i] = 126; } }
    }
  }
  // the near flights of the city (drawn by the shot, so fighters can stand on them): returns nothing
  function w5CityFlights(t, ox, oy) {
    w5Flight(-40 - ox, 262 - oy, 560 - ox, 82 - oy, 10, [124, 114, 128], false, t, 3, true);
    w5Flight(-80 - ox * 0.9, 38 - oy * 0.9, 600 - ox * 0.9, 118 - oy * 0.9, 10, [124, 114, 127], true, t, 4, true);
  }
  // the cathedral inside the dead black sun: a nave of obsidian columns, ribs of the vault, windows of dark fire, and at
  // its end, where a rose window would be, the sun itself: a black disc in a ring of fire
  function w5Cath(t, ox, oy, o) {
    o = o || {}; ox = ox || 0; oy = oy || 0;
    const top = LB, bot = H - LB, vx = 240 - ox * 0.12, vy = 118 - oy * 0.1, fire = o.fire === undefined ? 1 : o.fire;
    rectF(0, top, W, bot - top, 96);
    for (let y = top; y < bot; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - vx, (y - vy) * 1.3), n = vn(x, y + t * 6, 18, 8401); BUF[y * W + x] = d < 46 + n * 14 ? 98 : d < 86 + n * 22 ? (bay(x, y) < 0.5 ? 98 : 97) : d < 150 ? (bay(x, y) < 0.35 ? 97 : 96) : 96; }
    // the floor: polished, taking the fire's reflection; its joints run to the vanishing point
    const fy = vy + 26;
    for (let y = fl(fy); y < bot; y++) { const u = (y - fy) / (bot - fy); for (let x = 0; x < W; x++) { const wx = (x - vx) / (0.08 + u), rf = Math.abs(x - vx - Math.sin(y * 0.9 + t * 3) * (1 + u * 5)) < 8 + u * 46, jn = frac(wx / 60) < 0.03 / (0.2 + u) || frac(1.6 / (0.06 + u) + 0.5) < 0.05; BUF[y * W + x] = rf && ih(x >> 1, y, fl(t * 7)) < 0.55 * fire ? (u < 0.3 ? 103 : bay(x, y) < 0.5 ? 102 : 101) : jn ? 98 : u > 0.6 && bay(x, y) < 0.3 ? 97 : 96; } }
    // the rose: the black sun and its tracery
    blackSun(vx, vy - 4, 16, t, 0.85 * fire + 0.15);
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + t * 0.05; lineP(vx + Math.cos(a) * 31, vy - 4 + Math.sin(a) * 31, vx + Math.cos(a) * 41, vy - 4 + Math.sin(a) * 41, 99); discF(vx + Math.cos(a + 0.26) * 36, vy - 4 + Math.sin(a + 0.26) * 36, 2.2, fire > 0.5 ? 102 : 98); }
    ring(vx, vy - 4, 42, undefined, 99); ring(vx, vy - 4, 43, undefined, 98); ring(vx, vy - 4, 30, undefined, 98);
    light(vx, vy - 4, 120, L_CRIM, 0.4 * fire);
    // columns, far to near; between them the aisle windows burning; over them the ribs
    for (let k = 6; k >= 0; k--) {
      const z = 0.55 + k * 0.62 - (((ox * 0.004) % 0.62) + 0.62) % 0.62, zn = z - 0.62, yt = vy - 190 / z, yb = fy + 132 / z - 26 / z, cw = Math.max(2, 30 / z);
      for (const sd of [-1, 1]) {
        const cx = vx + sd * 250 / z;
        // the window in the wall beyond this column
        if (zn > 0.2) { const x2 = vx + sd * 250 / zn, wa = Math.min(cx, x2) + Math.abs(x2 - cx) * 0.3, wb = Math.min(cx, x2) + Math.abs(x2 - cx) * 0.75; for (let x = fl(wa); x <= wb; x++) { if (x < 0 || x >= W) continue; const zz = 250 / Math.abs(x - vx), u = (x - wa) / Math.max(1, wb - wa), pt = 1 - Math.abs(u - 0.5) * 2, y0 = vy - (130 + 34 * pt) / zz, y1 = vy + 40 / zz; for (let y = Math.max(top, fl(y0)); y < Math.min(bot, y1); y++) { const v = (y - y0) / (y1 - y0), n = vn(x * 0.7, y * 0.4 - t * 14, 5, 8402 + k); BUF[y * W + x] = n * fire > 0.62 - v * 0.2 ? (n > 0.8 ? 105 : 103) : n * fire > 0.4 ? 102 : bay(x, y) < 0.5 ? 101 : 97; } } }
        for (let x = fl(cx - cw / 2); x <= cx + cw / 2; x++) { if (x < 0 || x >= W) continue; const f = (x - (cx - cw / 2)) / cw, inner = sd > 0 ? f : 1 - f; const c = inner < 0.12 ? (fire > 0.4 ? 102 : 99) : inner < 0.3 ? 100 : inner < 0.5 ? 99 : inner < 0.8 ? 98 : 97, fl2 = cw > 8 && (fl(inner * 6) & 1); for (let y = Math.max(top, fl(yt)); y < Math.min(bot, yb); y++) BUF[y * W + x] = fl2 && bay(x, y) < 0.5 ? c - (c > 97 && c <= 100 ? 1 : 0) : c; }
        rectF(cx - cw * 0.75, yt - 3 / z, cw * 1.5, Math.max(1, 9 / z), 99); rectF(cx - cw * 0.75, yt - 3 / z, cw * 1.5, 1, 100); rectF(cx - cw * 0.8, yb - 8 / z, cw * 1.6, Math.max(1, 9 / z), 98);
        // dark fire licking at its foot
        for (let q = 0; q < cw * 1.6; q++) { const x = cx - cw * 0.8 + q, hgt = (6 + 22 * vn(x * 0.3, t * 5 + k, 1, 8403)) / z * fire; for (let y2 = 0; y2 < hgt; y2++) if (bay(fl(x), fl(yb - 8 / z - y2)) < 1 - y2 / hgt) P(x, yb - 8 / z - y2, y2 < hgt * 0.3 ? 104 : y2 < hgt * 0.6 ? 102 : 101); }
        // the rib springing to the crown of the vault
        const ax = vx, ay = yt - 150 / z; for (let u = 0; u <= 1; u += 0.012) { const px = z5Bz(cx, cx, ax, u), py = z5Bz(yt, ay + 30 / z, ay, u); P(px, py, 99); if (z < 2.4) { P(px, py + 1, fire > 0.4 ? 101 : 97); P(px + sd, py, 98); } }
      }
    }
    for (let k = 0; k < 46; k++) { const u = frac(ih(k, 1, 8404) + t * (0.12 + ih(k, 2, 8404) * 0.2)), x = ih(k, 3, 8404) * W + Math.sin(t * 1.3 + k) * 6, y = bot - u * (bot - top); if (bay(fl(x), fl(y)) < 1 - u * 0.7) P(x, y, k % 3 ? 103 : 105); }
  }
  // the night between the halves of a cut world: indigo, thick with stars, and a moon. o.moon: [x, y, r] (drawn whole)
  function w5Moon(mx, my, r, keep) {
    for (let y = Math.max(LB, fl(my - r)); y <= Math.min(H - LB - 1, my + r); y++) for (let x = Math.max(0, fl(mx - r)); x <= Math.min(W - 1, mx + r); x++) {
      const dx = (x + 0.5 - mx) / r, dy = (y + 0.5 - my) / r, d = dx * dx + dy * dy; if (d > 1 || (keep && !keep(dx * r, dy * r))) continue;
      const z = Math.sqrt(1 - d), l = -dx * 0.55 - dy * 0.45 + z * 0.6, mare = vn(x - mx, y - my, r * 0.45, 8501) + vn(x - mx, y - my, r * 0.15, 8502) * 0.4;
      let c = l > 0.72 ? 21 : l > 0.45 ? 20 : l > 0.18 ? 19 : l > -0.1 ? 18 : 17; if (mare > 0.82 && c > 17) c--; if (bay(x, y) < 0.3 && c > 17 && l < 0.6) c--;
      BUF[y * W + x] = c;
    }
    for (let k = 0; k < 9; k++) { const a = ih(k, 1, 8503) * TAU, q = Math.sqrt(ih(k, 2, 8503)) * 0.8, cx = mx + Math.cos(a) * q * r, cy = my + Math.sin(a) * q * r, cr = r * (0.06 + ih(k, 3, 8503) * 0.1); if (keep && !keep(cx - mx + cr, cy - my) ) continue; if (keep && !keep(cx - mx - cr, cy - my)) continue; ring(cx, cy, cr, cr * 0.8, 18); for (let b = 0.2; b < 1.9; b += 0.15 / cr) P(cx + Math.cos(b) * cr, cy + Math.sin(b) * cr * 0.8, 21); }
    light(mx, my, r * 2.6, L_COLD, 0.3);
  }
  function w5Night(t, ox, oy, o) {
    o = o || {}; ox = ox || 0; oy = oy || 0;
    const top = LB, bot = H - LB;
    gradient(top, bot, [0, 1, 1, 2, 63, 2, 1]);
    for (let y = top; y < bot; y++) for (let x = 0; x < W; x++) { const n = vn(x + ox * 0.04 + y * 0.9, y - x * 0.35, 40, 8510); if (n > 0.62 && bay(x, y) < (n - 0.62) * 3.2) BUF[y * W + x] = n > 0.8 ? 4 : 3; }
    for (let k = 0; k < 190; k++) { const x = ((ih(k, 1, 8511) * W - ox * (0.03 + 0.05 * (k % 3))) % W + W) % W, y = top + ((ih(k, 2, 8511) * (bot - top) - oy * (0.03 + 0.05 * (k % 3))) % (bot - top) + (bot - top)) % (bot - top), tw = frac(ih(k, 3, 8511) + t * 0.5); if (tw < 0.85) { P(x, y, k % 9 === 0 ? 22 : k % 4 === 0 ? 57 : 19); if (k % 23 === 0 && tw < 0.4) sparkle(x, y, 2, 22, 56); } }
    if (o.moon) w5Moon(o.moon[0], o.moon[1], o.moon[2]);
    if (!o.noShards) for (let k = 0; k < 7; k++) { const x = ((ih(k, 1, 8512) * 620 - ox * (0.2 + 0.1 * k)) % 620 + 620) % 620 - 70, y = top + 20 + ((ih(k, 2, 8512) * 190 - oy * (0.2 + 0.1 * k) + Math.sin(t * 0.6 + k) * 4) % 190 + 190) % 190, r = 5 + ih(k, 3, 8512) * 11; h5Shard(shardPts(x, y, r * 1.5, r, t * 0.2 * (k & 1 ? 1 : -1) + k, 40 + k, 5), ['dawn', 'ocean', 'city', 'ink'][k % 4], 120 + k * 50, 110 + (k % 3) * 30, t, { seed: k, dim: 0.5, glint: k % 2 === 0 }); }
  }
  // the world as Dawnbreak sees it: black, drawn in lines of light; hy: the burning horizon; o.burn 0..1, o.sunX, o.noLine
  function w5Line(t, ox, hy, o) {
    o = o || {}; ox = ox || 0;
    const top = LB, bot = H - LB, burn = o.burn === undefined ? 1 : o.burn, sunX = o.sunX === undefined ? 300 : o.sunX;
    rectF(0, top, W, bot - top, 0);
    // constellations
    for (let k = 0; k < 9; k++) {
      const cx = ((ih(k, 1, 8601) * 620 - ox * 0.05) % 620 + 620) % 620 - 70, cy = top + 8 + ih(k, 2, 8601) * Math.max(10, hy - top - 60); let px = cx, py = cy;
      for (let q = 0; q < 4; q++) { const nx = px + (ih(k, q, 8602) - 0.4) * 44, ny = py + (ih(k, q, 8603) - 0.5) * 30; if (ny < hy - 30 && ny > top + 2) lineF(px, py, nx, ny, (x, y) => { if ((x + y) % 3 === 0) P(x, y, 5); }); const tw = frac(ih(k, q, 8604) + t * 0.4); if (py < hy - 24) { P(px, py, tw < 0.5 ? 22 : 57); if (q === 0) sparkle(px, py, 1 + tw * 2, 57, 6); } px = nx; py = ny; }
    }
    // the sun: arcs on the horizon, long rays in thin line
    if (!o.noSun) {
      for (const [R, c, dash] of [[30, 22, 0], [31, 140, 0], [38, 141, 2], [47, 110, 3], [58, 12, 4]]) for (let a = PI; a < TAU; a += 0.6 / R) { const x = sunX + Math.cos(a) * R, y = hy + Math.sin(a) * R; if (dash && (fl(a * R / 3 + t * dash) % dash) === 0) continue; if (y < hy - 1) P(x, y, c); }
      for (let k = 0; k < 21; k++) { const a = PI + (k + 0.5) / 21 * PI, r0 = 64 + (k % 2) * 8, r1 = r0 + 30 + ih(k, 1, 8605) * 150 + Math.sin(t * 1.5 + k) * 8, ca = Math.cos(a), sa = Math.sin(a); lineF(sunX + ca * r0, hy + sa * r0, sunX + ca * r1, hy + sa * r1, (x, y, u) => { if (y > top && bay(x, y) < 1 - u * 0.75) P(x, y, u < 0.3 ? 141 : u < 0.6 ? 110 : 12); }); }
      light(sunX, hy, 120, L_GOLD, 0.3 * burn);
    }
    // contours of cloud above the line, and of the cloud sea below it, drawn as single lines
    for (let b = 0; b < 3; b++) {
      const yb = hy - 16 - b * 21, par = 0.5 - b * 0.14, c = [132, 133, 6][b]; let py = null;
      for (let x = 0; x < W; x++) { const wx = x + ox * par + b * 300, f = fbm(wx, 0, 70 - b * 12, 3, 8610 + b), y = f > 0.5 ? fl(yb - (f - 0.5) * 60 - Math.abs(Math.sin(wx * 0.12)) * 3) : null; if (y !== null && y > top) { if (py !== null) for (let yy = Math.min(y, py); yy <= Math.max(y, py); yy++) P(x, yy, c); else P(x, y, c); if (fl(wx) % 11 === 0 && f > 0.56) for (let q = 3; q < 9; q++) P(x + q, yb + 3 + (fl(wx / 11) % 3) * 3, b ? 5 : 133); } else if (py !== null) { for (let q = 0; q < 8; q++) P(x + q, py + 1, c); } py = y; }
    }
    for (let k = 1; k <= 8; k++) {
      const y0 = hy + 3 + k * k * 1.7, c = k < 2 ? 141 : k < 4 ? 110 : k < 6 ? 12 : 10; if (y0 >= bot) break;
      for (let x = 0; x < W; x++) { const wx = x + ox * (0.3 + k * 0.12), n = vn(wx, k * 7, 26 + k * 6, 8620); if (n < 0.34 + k * 0.02) continue; const y = y0 + Math.sin(wx * 0.05 / (0.4 + k * 0.1) + t * (1.4 - k * 0.1) + k) * (0.6 + k * 0.5); P(x, y, c); }
    }
    if (!o.noSun) for (let k = 0; k < 26; k++) { const x = sunX + (ih(k, 1, 8621) - 0.5) * 70, y = hy + 4 + ih(k, 2, 8621) * 70, L = 2 + ih(k, 3, 8621) * 8 * ((y - hy) / 70 + 0.3); if (frac(ih(k, 4, 8621) + t * 0.8) < 0.7) lineP(x - L, y, x + L, y, y < hy + 24 ? 140 : 141); }
    // far shards, in outline
    for (let k = 0; k < 7; k++) { const x = ((ih(k, 1, 8622) * 600 - ox * (0.15 + k * 0.05)) % 600 + 600) % 600 - 60, y = top + 14 + ih(k, 2, 8622) * (hy - top - 50) + Math.sin(t * 0.5 + k) * 3, pts = shardPts(x, y, 7 + ih(k, 3, 8622) * 12, 5 + ih(k, 4, 8622) * 8, t * 0.15 + k, 60 + k, 5); for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) lineP(pts[j][0], pts[j][1], pts[i][0], pts[i][1], k % 2 ? 137 : 136); }
    // the horizon: one burning line
    if (!o.noLine) w5Horizon(t, hy, 0, W, burn, ox);
  }
  function w5Horizon(t, hy, x0, x1, burn, ox) {
    for (let x = Math.max(0, fl(x0)); x < Math.min(W, x1); x++) {
      const wx = x + (ox || 0) * 0.6, hgt = (1.5 + 7 * Math.pow(vn(wx * 0.35, t * 4.5, 1, 8630), 2) + 3 * vn(wx * 0.08, t * 1.5, 1, 8631)) * burn;
      for (let q = 0; q < hgt; q++) { const u = q / hgt; if (bay(x, fl(hy - 2 - q)) < 1.1 - u) P(x, hy - 2 - q, u < 0.25 ? 140 : u < 0.5 ? 141 : u < 0.78 ? 110 : 105); }
      P(x, hy + 2, bay(x, hy + 2) < 0.5 ? 141 : 110); P(x, hy - 1, 22); P(x, hy, 22); P(x, hy + 1, 140);
    }
    for (let k = 0; k < 60; k++) { const u = frac(ih(k, 1, 8632) + t * (0.3 + ih(k, 2, 8632) * 0.5)), x = x0 + ih(k, 3, 8632) * (x1 - x0) + Math.sin(u * 7 + k) * 4, y = hy - 3 - u * (20 + ih(k, 4, 8632) * 46); if (x >= x0 && x < x1 && bay(fl(x), fl(y)) < (1 - u) * burn) P(x, y, u < 0.3 ? 140 : u < 0.6 ? 141 : 105); }
    for (let x = Math.max(30, x0); x < Math.min(W, x1); x += 70) light(x, hy, 44, L_GOLD, 0.34 * burn);
  }
  WORLDS.dawn = () => w5Dawn(1.0, 40, 192, 352, 170);
  WORLDS.ocean = () => w5Ocean(1.0, 60, 30, {});
  WORLDS.ink = () => w5Ink(1.0, 80, 0, {});
  WORLDS.city = () => { w5City(1.0, 90, 10, {}); w5CityFlights(1.0, 90, 10); };
  WORLDS.cath = () => w5Cath(1.0, 0, 0, {});
  WORLDS.night = () => w5Night(1.0, 0, 0, { moon: [330, 100, 30], noShards: true });

  /* ================================================================ ACT I — the shadow stands up (0.0–5.4)
     Dawn, where part IV ended. Ash from both brothers streams in from every edge of the frame into the hero's shadow on
     the cloud; the shadow boils, peels off and stands up behind it. 1.6 its eyes open. 3.0 a void blade through the hero's
     back and the sky cracks like glass from its point; 3.6 / 4.0 / 4.4 / 4.8 four strikes, each from another side; 5.4 an
     overhead slam drives the hero down through the cloud floor, which shatters. */
  {
  const HZ = 180, SUN = [354, 96], PUD = [132, 208];
  const D1 = (t) => t < 3.0 ? 0.1 : 0.35 + 0.12 * ((t >= 3.6) + (t >= 4.0) + (t >= 4.4) + (t >= 4.8)) + 0.1 * (t >= 5.4);
  const HITS = [[3.0, 0.134], [3.6, 0.1], [4.0, 0.1], [4.4, 0.1], [4.8, 0.1], [5.4, 0.134]];
  // where each blow lands (world), the way it throws the hero, how far its cracks run
  const BLOW = [[3.0, 300, 112, 0, 150], [3.6, 252, 120, PI, 100], [4.0, 120, 122, -1.2, 100], [4.4, 176, 42, 0.6, 100], [4.8, 332, 104, 0, 110]];
  const aH = TR([
    { t: 0, x: 232, y: 120, a: 0.16, sw: 0.55, S: 3, eyes: 'narrow', cr: 0.85, form: 'plain', nobob: false },
    { t: 1.6, x: 236, y: 118, a: 0.12 },
    { t: 1.78, x: 237, y: 116, a: 0.04, eyes: 'wide', e: 'o' },
    { t: 2.6, x: 238, y: 118, a: 0.02 },
    { t: 2.96, x: 240, y: 117, a: -0.1, e: 'i' },
    { t: 3.0, x: 254, y: 111, a: -0.5, sq: -0.22, mouth: 2, cr: 1, eyes: 'wide', e: 'l' },
    { t: 3.2, x: 254, y: 113, a: -0.36 },
    { t: 3.36, x: 236, y: 121, a: 0.24, sq: 0.12, e: 'o' },
    { t: 3.6, x: 238, y: 122, a: 0.34, sq: 0.3, eyes: 'closed', mouth: 1 },
    { t: 3.68, x: 214, y: 120, a: -0.9, sq: -0.2, mouth: 2, e: 'o' },
    { t: 3.9, x: 120, y: 112, a: -3.0, sq: 0, mouth: 2, e: 'o' },
    { t: 4.0, x: 116, y: 114, a: -3.3, sq: 0.3, e: 'l' },
    { t: 4.08, x: 128, y: 92, a: -4.1, sq: -0.2, e: 'o' },
    { t: 4.3, x: 172, y: 42, a: -5.6, sq: 0, e: 'o' },
    { t: 4.4, x: 176, y: 44, a: -5.8, sq: 0.3, e: 'l' },
    { t: 4.48, x: 206, y: 62, a: -5.2, sq: -0.2, e: 'o' },
    { t: 4.7, x: 326, y: 104, a: -4.3, sq: 0, e: 'o' },
    { t: 4.8, x: 330, y: 105, a: -4.2, sq: 0.32, e: 'l' },
    { t: 4.9, x: 350, y: 102, a: -3.4, sq: -0.2, e: 'o' },
    { t: 5.12, x: 347, y: 100, a: 0.5, sq: 0, mouth: 1, e: 'o' },
    { t: 5.4, x: 346, y: 103, a: 0.3, eyes: 'narrow' },
    { t: 5.5, x: 346, y: 330, a: 0.05, sq: -0.3, eyes: 'closed', mouth: 2, e: 'l' },
    { t: 6, x: 346, y: 800 },
  ]);
  const aE = TR([
    { t: 0, x: 124, y: 262, S: 3, a: 0, flip: false, eyes: 'closed', nosw: true, sq: -0.42, form: 'hollow', mask: false, arm: 0.6, hide: true },
    { t: 0.85, x: 124, y: 262, hide: false },
    { t: 1.5, x: 122, y: 126, sq: 0.06, e: 'o' },
    { t: 1.6, x: 122, y: 124, sq: 0, mask: true, eyes: 'wide' },
    { t: 1.95, x: 120, y: 124, eyes: 'narrow' },
    { t: 2.45, x: 118, y: 122, a: 0.04, arm: 0.2 },
    { t: 2.75, x: 100, y: 120, a: -0.14, sq: 0.12, arm: 0, e: 'o' },                    // drawn back
    { t: 2.88, x: 94, y: 119, a: -0.2, sq: 0.2, arm: 0 },
    { t: 3.0, x: 174, y: 116, a: -0.14, sq: -0.14, arm: 0, nolean: true, e: 'i' },        // the thrust
    { t: 3.2, x: 176, y: 116, a: -0.14 },
    { t: 3.36, x: 110, y: 122, a: -0.1, sq: 0, e: 'o' },                                 // ripped out
    { t: 3.37, x: 110, y: 122, nosw: false, sw: 0.2, arm: undefined },
    { t: 3.47, x: 326, y: 110, flip: true, sw: -2.1, a: 0.22, sq: 0.08 },
    { t: 3.56, x: 330, y: 108, sw: -2.5, a: 0.34, sq: 0.2, e: 'o' },
    { t: 3.6, x: 296, y: 120, sw: 0.9, a: -0.2, sq: -0.05, e: EQ },
    { t: 3.72, x: 268, y: 124, sw: 1.7, a: -0.3, e: 'o' },
    { t: 3.86, x: 92, y: 196, flip: false, sw: 1.3, a: 0.2, sq: 0.1 },
    { t: 3.96, x: 88, y: 200, sw: 1.7, a: 0.32, sq: 0.24, e: 'o' },
    { t: 4.0, x: 112, y: 152, sw: -1.3, a: -0.25, sq: -0.1, e: EQ },
    { t: 4.1, x: 120, y: 130, sw: -2.1, e: 'o' },
    { t: 4.26, x: 126, y: 4, sw: -2.2, a: -0.2, sq: 0.08 },
    { t: 4.36, x: 122, y: -2, sw: -2.6, a: -0.32, sq: 0.22, e: 'o' },
    { t: 4.4, x: 148, y: 22, sw: 0.7, a: 0.3, sq: -0.05, e: EQ },
    { t: 4.5, x: 156, y: 34, sw: 1.4, e: 'o' },
    { t: 4.66, x: 200, y: 106, sw: 0, a: -0.08, sq: 0.12, reach: 0 },
    { t: 4.76, x: 190, y: 107, sw: 0, a: -0.16, sq: 0.26, e: 'o' },
    { t: 4.8, x: 318, y: 104, sw: 0, a: 0.05, sq: -0.2, reach: 4, e: EQ },
    { t: 4.9, x: 446, y: 100, sw: 0.1, sq: 0, e: 'o' },
    { t: 5.12, x: 356, y: 4, flip: true, sw: -2.0, a: 0.3, sq: 0.08, reach: 0 },
    { t: 5.33, x: 354, y: -4, sw: -2.2, a: 0.38, sq: 0.16 },
    { t: 5.4, x: 348, y: 66, sw: 1.1, a: -0.3, sq: -0.16, e: EQ },
    { t: 5.52, x: 348, y: 104, sw: 1.7, a: -0.4, sq: 0, e: 'o' },
    { t: 6, x: 348, y: 108 },
  ], { 3.47: 70, 3.86: -60, 4.26: -50, 4.66: -30, 5.12: 60 });
  aE[10].arm = undefined;
  for (let k = 10; k < aE.length; k++) delete aE[k].arm;
  // the camera: a slow push on the two of them; at 3.0 a crash-in to the blade coming out of its chest (held), then a whip
  // back out to a follow-shot of the blitz, and a pull back for the slam
  const ECU = [286, 120, 1.62];
  const view = (t) => {
    const kk = kick(t, [[3.0, 1.4, 0], [3.6, 1.6, PI], [4.0, 1.6, -1.2], [4.4, 1.6, 0.6], [4.8, 1.7, 0], [5.4, 2.6, PI / 2]]);
    let x, y, z;
    if (t < 3.0) { const u = eio(clip01(1.6, 2.98, t)); z = t < 1.6 ? lerp(1.0, 1.1, eio(t / 1.6)) : lerp(1.15, 1.42, u); x = t < 1.6 ? 226 : lerp(208, 198, u); y = t < 1.6 ? 126 : lerp(124, 120, u); }
    else if (t < 3.42) { const u = clip01(3.13, 3.42, t); z = ECU[2] + 0.25 * u; x = ECU[0] + 4 * u; y = ECU[1]; }
    else {
      let sx = 0, sy = 0; for (let k = 0; k < 8; k++) { const p = h5Trk(aH, Math.max(3.42, t - k * 0.04)); sx += p.x / 8; sy += p.y / 8; }
      const w = eoc(clip01(3.42, 3.56, t)), sl = eio(clip01(5.05, 5.36, t));
      x = lerp(ECU[0], lerp(sx, 240, 0.35), w); y = lerp(ECU[1], lerp(sy, 118, 0.4), w); z = lerp(ECU[2], 1.12, w);
      x = lerp(x, 330, sl); y = lerp(y, 92, sl); z = lerp(z, 0.95, sl);
    }
    return { x: x - kk[2] * 1.2, y: y - kk[3] * 1.2, z: z * (1 + kk[0] * 1.2), r: kk[1] };
  };
  // the dawn, the cracks in it, and the worlds starting to show behind the broken panes
  function a1Sky(t, V) {
    const zs = Math.pow(V.z, 0.85);
    w5Dawn(t, t * 6 + (V.x - 240) * 0.3, (HZ - V.y) * zs + 135, (SUN[0] - V.x) * zs + 240, (SUN[1] - V.y) * zs + 135, { sunR: zs });
    if (t >= 3.0) {
      const hits = BLOW.map(([h, x, y, d, R]) => [vX(V, x), vY(V, y), t < h ? 0 : Math.min(R, (t - h) * 700) + (t - h) * 12]);
      glassAct(hits);
      { const PANES = [[3.6, 252, 120, 'ocean'], [4.0, 120, 122, 'city'], [4.4, 176, 42, 'ink'], [4.8, 332, 104, 'cath']], pick = []; for (const [h, x, y, w] of PANES) { if (t < h + 0.05) continue; let b = 0, bd = 1e9; for (let q = 0; q < GN; q++) { const d = Math.hypot(GSX[q] - vX(V, x), GSY[q] - vY(V, y)); if (d < bd) { bd = d; b = q; } } pick.push([b, wview(w), h]); } const recent = pick.slice(-2); glassWindows((q) => { for (const p of recent) if (p[0] === q) return p[1]; return null; }, (q) => { for (const p of recent) if (p[0] === q) return clip01(p[2] + 0.04, p[2] + 0.2, t); return 0; }, 0, 0); }
      glassCracks(hits);
    }
  }
  let A1EXIT = null, A1TIPW = null;
  // the near layer: big flakes of ash crossing the lens, and (once the sky has cracked) splinters of it coming down
  function a1Fore(t, V) {
    for (let k = 0; k < 22; k++) { const sp = 30 + ih(k, 1, 9130) * 40, x = ((ih(k, 2, 9130) * 600 - t * sp - (V.x - 240) * 1.6) % 600 + 600) % 600 - 60, y = LB + ((ih(k, 3, 9130) * 240 + t * (10 + ih(k, 4, 9130) * 14) - (V.y - 124) * 1.6) % 240), s = 2 + fl(ih(k, 5, 9130) * 2.5); rectF(x, y, s + 1, s, k % 5 === 0 ? 72 : k % 3 ? 0 : 120); if (k % 4 === 0) P(x + s + 1, y, 102); }
    if (t > 3.62) for (let k = 0; k < 12; k++) { const b = 3.62 + ih(k, 1, 9131) * 1.6, a = t - b; if (a < 0) continue; const x = 30 + ih(k, 2, 9131) * 420 + Math.sin(a * 2 + k) * 10 - (V.x - 240) * 1.3, y = LB - 10 + a * a * 140 + a * 30, r = 3 + ih(k, 3, 9131) * 6; if (y > H) continue; h5Shard(shardPts(x, y, r * 1.5, r, a * 3 + k, 110 + k, 5), ['ocean', 'city', 'ink', 'cath'][k % 4], 100 + k * 30, 80 + k * 9, t, { seed: k, glint: k % 2 === 0 }); }
  }
  function a1Scene(t) {
    const V = view(t), [tt, fz] = h5Clock(t, HITS, 0.1, 2.6), frz = fz ? 1.5 : 0;
    H5PX = 0; H5PY = 0;
    a1Sky(t, V);
    // the ash of both brothers, from every edge, into the shadow
    const drain = clip01(0.9, 1.7, t), px = vX(V, PUD[0]), py = vY(V, PUD[1]);
    ashStreams(t + 3, px, py - 60 * eio(drain), 420, 1 - clip01(1.5, 2.3, t), 9101);
    // the shadow on the cloud: it boils, spreads, then drains up into what stands
    if (t < 1.9) {
      const grow = eoc(clip01(-0.5, 0.9, t)) * (1 - eio(drain)), rx = (26 + 30 * grow) * V.z, ry = (3.5 + 3.5 * grow) * V.z;
      for (let y = fl(py - ry - 14); y <= py + ry + 2; y++) for (let x = fl(px - rx - 8); x <= px + rx + 8; x++) {
        const dx = (x - px) / rx, dy = (y - py) / ry, n = vn(x + t * 9, y * 3 - t * 30, 5, 9102), d = dx * dx + dy * dy - (n - 0.5) * 0.9 * (dy < 0 ? 1.8 : 0.5);
        if (d > 1) continue; P(x, y, d > 0.78 ? (ih(x, fl(t * 12), 9103) < 0.3 ? 72 : 78) : ih(x, y, 9104) < 0.02 ? 57 : 134);
      }
      for (let k = 0; k < 9; k++) { const u = frac(ih(k, 1, 9105) + t * (0.9 + ih(k, 2, 9105))), bx = px + (ih(k, 3, 9105) - 0.5) * 2 * rx, hh = (10 + ih(k, 4, 9105) * 34) * grow * V.z * Math.sin(u * PI); for (let q = 0; q < hh; q++) { const xx = bx + Math.sin(q * 0.3 + t * 6 + k) * 2; P(xx, py - q, q > hh - 2 ? 72 : 134); if (q < hh * 0.5) P(xx + 1, py - q, 134); } }
      light(px, py, 60, L_DARK, 0.3 * grow);
    }
    // the Hollow
    const pe = h5Pose(aE, tt);
    let E = null;
    if (!pe.hide) {
      const rising = t < 1.6, base = { form: 'hollow', frz };
      if (rising) { const k2 = aE.map((k) => Object.assign({}, k)); k2.arcs = aE.arcs; for (const k of k2) k.clipY = py + 1; E = h5F(k2, tt, base, V); for (let q = 0; q < 14; q++) { const u = frac(ih(q, 1, 9106) + t * 1.4), xx = E.x + (ih(q, 2, 9106) - 0.5) * 60 * V.z, y0 = E.y + 20 * V.z; lineF(xx, Math.min(py, y0 + u * 30), xx + Math.sin(t * 5 + q) * 3, py, (X, Y, f) => { if (bay(X, Y) < 0.8 - f * 0.4) P(X, Y, f > 0.9 ? 72 : 134); }); } }
      else E = h5F(aE, tt, base, V);
      // the tell: a glint runs up the blade; then the thrust smears
      if (E.tip && t > 2.62 && t < 2.9) { const u = clip01(2.62, 2.86, t); sparkle(lerp(E.hand[0], E.tip[0], u), lerp(E.hand[1], E.tip[1], u), 2 + 5 * u, 22, 74); }
      // the blade: it draws itself out of the ash in its hand, and it is this that goes through the hero
      if (t > 1.95 && tt < 3.37) {
        const g = eoc(clip01(1.95, 2.5, t)), ang = lerp(0.9, 0, eio(clip01(2.3, 2.9, t))) + pe.ang, len = lerp(80, 122, clip01(2.96, 3.0, t)) * g * V.z, hx = E.hand[0] + Math.cos(ang) * 4 * V.z, hy = E.hand[1] + Math.sin(ang) * 4 * V.z;
        bigBlade(hx, hy, ang, len, 4.2 * V.z, t, { form: 'void', grow: g < 1 ? 0.999 : 1, flare: 0.5 });
        if (g < 1) for (let k = 0; k < 16; k++) { const u = frac(ih(k, 1, 9107) + t * 2), a2 = ih(k, 2, 9107) * TAU; P(hx + Math.cos(ang) * len + Math.cos(a2) * 22 * (1 - u), hy + Math.sin(ang) * len + Math.sin(a2) * 22 * (1 - u), k % 3 ? 121 : 72); }
        E.tip = [hx + Math.cos(ang) * len, hy + Math.sin(ang) * len];
        if (t > 2.9 && t < 3.0) for (let k = 0; k < 12; k++) { const o = (k - 5.5) * 3 * V.z, L2 = (60 + ih(k, 1, 9116) * 90) * V.z, c = Math.cos(ang), s2 = Math.sin(ang), bx = hx - s2 * o, by = hy + c * o; lineF(bx, by, bx - c * L2, by - s2 * L2, (X, Y, u) => { if (bay(X, Y) < 0.95 - u) P(X, Y, k % 3 ? 78 : 74); }); }
      }
      h5Ash(aE, tt, V, t < 1.6 ? 40 : 24, -26, -30, undefined, 0.8);
      if (t >= 1.6 && t < 1.9) { const g = t - 1.6; shockRing(E.x, E.y - 6, 10 + g * 300, 6 + g * 170, 2, [74, 72, 102], 1 - g / 0.3); light(E.x, E.y, 90 * (1 - g / 0.3), L_MAG, 0.7); }
    }
    // the hero (drawn over the blade: it enters its back and comes out of its chest)
    const ph = h5Pose(aH, tt), hx0 = vX(V, ph.x), hy0 = vY(V, ph.y);
    // the four sparks that stayed with it: knocked away when the blade lands
    const sg = t - 3.0;
    for (let pass = 0; pass < 2; pass++) {
      if (pass) { const HR = h5F(aH, tt, { form: 'plain', frz, rim: [1, -0.4, 60], dmg: D1 }, V); A1EXIT = null; if (E && E.tip && tt >= 3.0 && tt < 3.34) { const ex = HR.x + 36 * V.z, L2 = E.tip[0] - ex; A1EXIT = [ex, E.tip[1]]; if (t < 3.02) A1TIPW = [(E.tip[0] - 240) / V.z + V.x, (E.tip[1] - 135) / V.z + V.y]; if (L2 > 4) { bigBlade(ex, E.tip[1], 0, L2, 4.2 * V.z, t, { form: 'void', flare: 0.7, noHilt: true }); for (let k = 0; k < 8; k++) { const u = frac(ih(k, 1, 9109) + t * 2.2); P(ex + ih(k, 2, 9109) * L2, E.tip[1] + 4 + u * 26, u < 0.4 ? 22 : 59); } sparkle(ex, E.tip[1], 5, 22, 59); } } if (t > 3.0) { for (let k = 0; k < 10; k++) { const u = frac(ih(k, 1, 9108) + t * 1.3), a2 = ih(k, 2, 9108) * TAU; if (bay(k, fl(t * 30)) < 1 - u) P(HR.x + Math.cos(a2) * 30 * u * V.z + (ih(k, 3, 9108) - 0.5) * 30, HR.y + Math.sin(a2) * 20 * u + 30 * u * u, u < 0.4 ? 22 : 59); } light(HR.x, HR.y, 50, L_GOLD, 0.25); } }
      for (let k = 0; k < 4; k++) {
        const a = t * 0.75 + k * TAU / 4, zz = Math.sin(a); if ((zz > 0) !== !!pass) continue;
        let x = hx0 + Math.cos(a) * 62 * V.z, y = hy0 - 10 + zz * 22 * V.z + Math.sin(t * 2 + k) * 3, al = 1;
        if (sg > 0) { const d = eoc(sg / 0.5), aa = a + (k - 1.5) * 0.3; x += Math.cos(aa) * 260 * d; y += Math.sin(aa) * 150 * d - 40 * d; al = 1 - sg / 0.5; if (al <= 0) continue; }
        if (bay(k, fl(t * 30)) > al) continue;
        light(x, y, 16, [L_COLD, [0.5, 1, 0.4], L_GOLD, L_VIO][k], 0.5 * al); discF(x, y, 3.2, 63); discF(x, y, 2.4, ORB[k][1]); discF(x - 0.7, y - 0.7, 1.3, ORB[k][2]); P(x - 1, y - 1, 22);
        for (let q = 1; q < 7; q++) { const a3 = a - q * 0.04; if (sg <= 0 && bay(fl(x) + q, fl(y)) < 1 - q / 7) P(hx0 + Math.cos(a3) * 62 * V.z, hy0 - 10 + Math.sin(a3) * 22 * V.z + Math.sin(t * 2 + k) * 3, ORB[k][q < 3 ? 2 : 1]); }
      }
    }
    // the blows
    for (let k = 0; k < BLOW.length; k++) { const [h, x, y, d] = BLOW[k], g = t - h; if (g < 0 || g > 1.1) continue; if (k === 0) { if (A1EXIT) h5Blow(A1EXIT[0], A1EXIT[1], g, 1.6, 0.1, [22, 104, 102], 9110, 2, [72, 73, 74, 104, 107, 0, 134, 77, 78], L_CRIM, ['ocean', 'city', 'ink']); } else h5Blow(vX(V, x), vY(V, y), g, 1.3, d, [22, 74, 72], 9111 + k, 0, null, L_MAG, ['dawn', 'ocean', 'ink']); }
    if (t >= 5.4) h5Blow(vX(V, 346), vY(V, 92), t - 5.4, 2.6, PI / 2, [22, 74, 72], 9119, 1, [72, 73, 74, 104, 107], L_MAG);
    a1Fore(t, V);
    if (V.r) z5Cam(1, V.r, 240, 135);
    return V;
  }
  shot(0, 5.4334, (lt, t) => { a1Scene(t); if (t < 0.25) { GD.flash = 0.25 * (1 - t / 0.25); GD.fc = [1, 0.9, 0.75]; } });
  CAPS.push([2.2, 3.5, 's', 'HOLLOW', 'YOU LEFT A SHADOW.']);
  // (kept for the breach: the sky as it was when the floor went)
  WORLDS.a1 = () => { const V = { x: 240, y: 124, z: 0.8, r: 0 }; a1Sky(5.4, V); };
  }

  /* ================================================================ ACT I/II — the fall, Zenith Nova, the duel on the falling sky (5.4–11.6)
     One world (the ocean hanging overhead, its teeth pointing down) and one frame of reference: the broken sky falling
     through it. The hero is slammed in from above, catches a shard one-handed and swings up onto it (6.15–6.7); 7.5 ZENITH
     NOVA; then one travelling shot to the right across the shards: clashes at 8.2 (a rising cut meets a diving one), 8.8 (a
     duck under a sweep, an uppercut into a block), 9.3 (a kick into a guard), 9.7 (a leaping spin that cuts the shard
     under them in half), 10.0 (thrust past thrust), and at 10.6 the blades lock and every shard round them bursts. */
  {
  const SLAB = [[150, 260, 170, 26, 1, 'dawn'], [330, 430, 120, 22, 2, 'a1'], [300, 560, 190, 30, 3, 'dawn'], [545, 635, 176, 20, 4, 'ink'], [600, 700, 120, 24, 5, 'dawn'], [690, 820, 200, 28, 6, 'city'], [760, 850, 150, 22, 7, 'dawn'], [1000, 1085, 150, 22, 8, 'a1']];
  const HITS = [[7.5, 0.1], [8.2, 0.1], [8.8, 0.1], [9.3, 0.1], [9.7, 0.1], [10.0, 0.067], [10.6, 0.167]];
  const CL = [[8.2, 305, 107, -0.6], [8.8, 462, 114, -1.2], [9.3, 624, 96, 2.6], [9.7, 749, 192, 0.5], [10.0, 774, 192, 0]];
  const D2 = (t) => t < 7.5 ? 0 : clamp(0.06 * ((t >= 8.2) + (t >= 8.8) + (t >= 9.3) + (t >= 9.7) + (t >= 10.0)) + 0.12 * (t >= 10.6), 0, 1);
  const bH = TR([
    { t: 5.4, x: 250, y: -70, a: 0.6, sw: 0.5, S: 2, eyes: 'closed', mouth: 2, cr: 1, form: 'plain' },
    { t: 5.78, x: 264, y: 60, a: 3.6, e: 'l' },
    { t: 6.04, x: 280, y: 150, a: 6.0, eyes: 'wide', mouth: 1, e: 'l' },
    { t: 6.15, x: 290, y: 192, a: 6.48, arm2: [-2.0, 8, 1], eyes: 'angry', mouth: 0, e: 'o' },
    { t: 6.1501, a: 0.2 },
    { t: 6.3, x: 302, y: 150, a: -1.3 },
    { t: 6.43, x: 264, y: 118, a: -4.2, arm2: null },
    { t: 6.55, x: 236, y: 147, a: -6.283, sq: 0.34, e: 'o' },
    { t: 6.5501, a: 0 },
    { t: 6.74, x: 234, y: 142, sq: 0, sw: 0.6 },
    { t: 7.2, x: 234, y: 142, sw: -0.5 },
    { t: 7.46, x: 234, y: 146, sq: 0.28, sw: -0.9 },
    { t: 7.5, x: 234, y: 136, sq: -0.22, sw: -1.5, form: 'nova', swl: 9, spread: 0.1, cr: 0, eyes: 'glow', aur: 2.2, e: 'l' },
    { t: 7.72, x: 234, y: 132, sq: 0, swl: 30, spread: 1.25, aur: 1.3, e: 'o' },
    { t: 7.86, x: 234, y: 136, sw: -1.2, spread: 1, aur: 1 },
    { t: 8.02, x: 212, y: 152, sw: 1.5, a: -0.15, sq: 0.25, e: 'o' },
    { t: 8.2, x: 250, y: 140, sw: -0.9, a: 0.1, sq: -0.14, e: EQ },
    { t: 8.3, x: 244, y: 150, sw: -0.4, a: -0.2, sq: 0, e: 'o' },
    { t: 8.46, x: 330, y: 166, sw: 0.3, a: 0, sq: 0.25 },
    { t: 8.54, x: 356, y: 166, sw: 0.2, sq: 0, run: true },
    { t: 8.6, x: 376, y: 174, sq: 0.42, sw: 1.2 },
    { t: 8.7, x: 398, y: 172, sq: 0.38, sw: 1.6, run: false },
    { t: 8.8, x: 410, y: 150, sw: -1.0, sq: -0.18, e: EQ },
    { t: 8.9, x: 416, y: 132, sw: -2.1, sq: -0.05, e: 'o' },
    { t: 9.02, x: 436, y: 166, sw: -0.6, sq: 0.22 },
    { t: 9.15, x: 530, y: 166, sq: 0, run: true, sw: -0.3 },
    { t: 9.3, x: 590, y: 108, sw: -1.45, reach: 2, run: false, sq: -0.1, a: -0.1 },
    { t: 9.45, x: 578, y: 152, a: 0.3, sq: 0.3, reach: 0, sw: -0.9, e: 'o' },
    { t: 9.52, x: 572, y: 152, a: 0, sq: 0.28, sw: -2.7 },
    { t: 9.7, x: 688, y: 168, a: 6.283, sw: 0.7, sq: -0.1, e: EQ },
    { t: 9.7001, a: 0 },
    { t: 9.86, x: 690, y: 184, sw: 0, a: -0.08, sq: 0.2, reach: 0 },
    { t: 10.0, x: 712, y: 192, sw: 0, reach: 4, sq: -0.15, a: -0.05, e: EQ },
    { t: 10.08, x: 700, y: 190, reach: 0, sq: 0.22, sw: -0.7, e: 'o' },
    { t: 10.27, x: 805, y: 126, sq: 0.3, sw: -2.4, a: 0 },
    { t: 10.42, x: 802, y: 128, sq: 0.34, sw: -2.6 },
    { t: 10.6, x: 864, y: 130, sw: -0.8, sq: -0.12, e: EQ },
    { t: 10.8, x: 888, y: 130, sw: -1.25, sq: 0.05, vib: 0.7, mouth: 1, eyes: 'angry', e: 'o' },
    { t: 11.05, x: 892, y: 130 }, { t: 11.25, x: 881, y: 131 }, { t: 11.45, x: 894, y: 129 }, { t: 11.7, x: 889, y: 130 },
  ], { 8.46: 26, 9.3: 30, 9.7: 36, 10.27: 40 });
  const bE = TR([
    { t: 5.4, x: 420, y: -80, flip: true, sw: 0.4, S: 2, form: 'hollow', eyes: 'narrow', hide: true },
    { t: 6.2, x: 404, y: -60, hide: false },
    { t: 6.85, x: 380, y: 92, sq: 0, e: 'o' },
    { t: 6.95, x: 380, y: 93, sq: 0.14 },
    { t: 7.1, x: 380, y: 92, sq: 0 },
    { t: 7.5, x: 380, y: 92, sw: 0.4, a: 0 },
    { t: 7.58, x: 390, y: 90, a: -0.14, eyes: 'wide', sw: 0.1, e: 'o' },
    { t: 7.82, x: 384, y: 94, sq: 0.25, a: 0, sw: -1.6, eyes: 'narrow' },
    { t: 8.04, x: 374, y: 50, sw: -2.3, sq: -0.1, a: 0.2, e: 'o' },
    { t: 8.2, x: 368, y: 86, sw: 0.6, sq: -0.12, a: -0.1, e: EQ },
    { t: 8.3, x: 386, y: 100, sw: 0.2, a: 0.25, sq: 0, e: 'o' },
    { t: 8.45, x: 448, y: 162, sw: -0.5, a: 0, sq: 0.25 },
    { t: 8.52, x: 456, y: 162, sw: -2.0, sq: 0, run: true },
    { t: 8.62, x: 470, y: 160, sw: 0.5, reach: 3, e: EQ },
    { t: 8.72, x: 492, y: 158, sw: 0.9, reach: 0, run: false },
    { t: 8.8, x: 522, y: 122, sw: 0.1, a: 0.1, sq: -0.1, e: 'o' },
    { t: 9.1, x: 650, y: 92, a: 6.283, sw: -1.0, sq: 0.28 },
    { t: 9.1001, a: 0 },
    { t: 9.2, x: 652, y: 94, a: -0.38, sq: 0.3, sw: -2.0 },
    { t: 9.3, x: 656, y: 80, a: 1.0, lk: 1, sq: -0.15, e: EQ },
    { t: 9.38, x: 668, y: 74, a: 0.7, lk: 0.5, e: 'o' },
    { t: 9.54, x: 790, y: 172, a: 0, lk: 0, sq: 0.25, sw: 0.3 },
    { t: 9.62, x: 800, y: 172, sq: 0, sw: -0.4 },
    { t: 9.7, x: 808, y: 170, sw: 0.7, sq: 0.1, e: 'o' },
    { t: 9.86, x: 848, y: 186, sw: 0.0, a: 0.07, sq: 0.2, reach: 0 },
    { t: 10.0, x: 836, y: 196, sw: 0.0, reach: 4, sq: -0.15, e: EQ },
    { t: 10.08, x: 850, y: 190, reach: 0, sq: 0.2, sw: -0.6, e: 'o' },
    { t: 10.27, x: 1040, y: 122, a: 0, sq: 0.3, sw: -2.4 },
    { t: 10.42, x: 1043, y: 124, sq: 0.34, sw: -2.6 },
    { t: 10.6, x: 982, y: 130, sw: -0.8, sq: -0.12, e: EQ },
    { t: 10.8, x: 958, y: 130, sw: -1.25, sq: 0.05, vib: 0.7, eyes: 'wide', e: 'o' },
    { t: 11.05, x: 963, y: 130 }, { t: 11.25, x: 951, y: 131 }, { t: 11.45, x: 965, y: 129 }, { t: 11.7, x: 960, y: 130 },
  ], { 8.04: -10, 9.1: 46, 9.54: 30, 10.27: 44 });
  const CAMK = [[5.4, 240, 135, 1], [6.1, 250, 150, 1.1], [6.6, 292, 130, 1.5], [7.44, 288, 128, 1.56], [7.5, 250, 130, 1.8], [7.95, 300, 128, 1.2], [8.2, 306, 124, 1.28], [8.8, 462, 138, 1.22], [9.3, 616, 112, 1.28], [9.7, 746, 162, 1.22], [10.0, 774, 172, 1.3], [10.42, 922, 132, 1.5], [10.6, 923, 126, 1.6], [10.8, 923, 120, 2.2], [10.98, 923, 116, 3.1], [11.45, 924, 116, 3.35], [11.6, 924, 118, 2.4]];
  function b2View(t) {
    const AF = h5Frame(bH, bE, t, { fill: 330, pad: 90, zmin: 1.4, zmax: 1.8, oy: -8 }), wa = sstep(7.8, 8.0, t) * (1 - sstep(10.36, 10.56, t));
    const C = b2Cam(t); return { x: lerp(C.x, AF.x - (C.kx || 0), wa), y: lerp(C.y, AF.y - (C.ky || 0), wa), z: lerp(C.z, AF.z * (1 + (C.kz || 0)), wa), r: C.r };
  }
  function b2Cam(t) {
    let k = 0; while (k < CAMK.length - 2 && CAMK[k + 1][0] <= t) k++;
    const A = CAMK[k], B = CAMK[k + 1], u = (k === 3 || k === 12 ? eoc : eio)(clip01(A[0], B[0], t));
    const kk = kick(t, [[7.5, 2, -PI / 2], [8.2, 1, -0.6], [8.8, 1.1, -1.3], [9.3, 1.1, 2.8], [9.7, 1.3, 0.6], [10.0, 0.9, 0], [10.6, 2.6, 0]]);
    return { x: lerp(A[1], B[1], u) - kk[2], y: lerp(A[2], B[2], u) - kk[3], z: lerp(A[3], B[3], u) * (1 + kk[0]), r: kk[1], kx: kk[2], ky: kk[3], kz: kk[0] };
  }
  const fall = (t) => 210 * (t - 5.4) + 170 * (1 - Math.exp(-(t - 5.4) * 3));
  function b2Bg(t, V) {
    const rush = t > 10.6 ? Math.pow(t - 10.6, 2) * 900 : 0;
    w5Ocean(t, V.x * 0.5 + rush, fall(t), { hole: [250 - (V.x - 240) * 0.12, clamp(1 - (t - 5.4) * 0.22, 0, 1)], lx: 250 - (V.x - 240) * 0.2 });
    if (rush > 0) streaks(PI, 26, t, 1500, 117, 70 + rush * 0.1, 9201);
  }
  // loose shards of sky falling with them, at every depth
  const DEC = []; for (let k = 0; k < 26; k++) DEC.push({ x: ih(k, 1, 9202) * 1500 - 150, y: ih(k, 2, 9202) * 330 - 30, r: 6 + ih(k, 3, 9202) * (k % 5 === 0 ? 30 : 15), par: k % 5 === 0 ? 1.5 + ih(k, 4, 9202) * 0.5 : 0.4 + ih(k, 4, 9202) * 0.6, view: ['dawn', 'a1', 'dawn', 'city', 'ink', 'dawn', 'cath'][k % 7], rs: (ih(k, 5, 9202) - 0.5) * 1.6, rise: 14 + ih(k, 6, 9202) * 40 });
  function b2Dec(t, V, front) {
    const burst = t - 10.6;
    for (let k = 0; k < DEC.length; k++) {
      const D = DEC[k]; if ((D.par > 1.2) !== front) continue;
      let sx = 240 + (D.x - V.x) * D.par * V.z, sy = ((135 + (D.y - V.y) * D.par - (t - 5.4) * D.rise * D.par) % 330 + 330) % 330 - 30 + Math.sin(t * 0.9 + k) * 3;
      if (sx < -70 || sx > W + 70) continue;
      const r = D.r * (front ? 1 : V.z) * (0.7 + D.par * 0.4);
      if (burst > 0 && !front) { if (burst < 0.6) rocks(sx, sy, burst, 5, 150, r * 0.5, [137, 136, 135, 22], 9203 + k, 60); continue; }
      h5Shard(shardPts(sx, sy, r * 1.5, r, t * D.rs + k, 20 + k, 5 + (k % 3)), D.view, 60 + (k * 37) % 360, 50 + (k * 53) % 150, t, { seed: k, dim: front ? 0.75 : D.par < 0.7 ? 0.45 : 0, th: front ? 0 : 2, glint: !front });
    }
  }
  function b2Slabs(t, V) {
    const burst = t - 10.6;
    for (let k = 0; k < SLAB.length; k++) {
      const [x0, x1, y, dp, sd, view] = SLAB[k], cx = vX(V, (x0 + x1) / 2), cy = vY(V, y);
      if (cx < -160 || cx > W + 160) continue;
      if (burst > 0) { if (burst < 0.7) rocks(cx, cy + 6, burst, 9, 230, 7 * V.z, [137, 136, 135, 22], 9210 + k, 80); continue; }
      const S = (a, b, yy, rot, d2, s2) => h5Shard(slabPts(vX(V, a), vX(V, b), vY(V, yy), rot, d2 * V.z, s2), view, 100 + sd * 40, 80 + sd * 14, t, { th: 3, seed: sd });
      if (k === 5 && t > 9.7) { const g = t - 9.7; S(690, 749, 200 + g * 95, -g * 0.8, dp, 61); S(749, 820, 200 + g * 105, g * 0.7, dp, 62); if (g < 0.1) { thick(vX(V, 760), vY(V, 150), vX(V, 738), vY(V, 250), 3, 22); light(vX(V, 749), vY(V, 200), 70, L_WARM, 0.8); } rocks(vX(V, 749), vY(V, 204), g, 8, 120, 3, [137, 136, 135, 22], 9220, 220); }
      else S(x0, x1, y, 0, dp, sd);
    }
  }
  function b2Scene(t) {
    const V = b2View(t), [tt, fz] = h5Clock(t, HITS, 0.1, 2.4), frz = fz ? 1.5 : 0;
    H5PX = V.x * 0.4; H5PY = fall(t) * 0.1;
    b2Bg(t, V);
    b2Dec(t, V, false);
    if (t < 6.2) h5Shatter(WORLDS.a1, t - 5.4, 280, 140, { v: 330, dur: 0.62, grav: -160, delay: 0.0006 });
    b2Slabs(t, V);
    // the zenith nova: a sun behind it for a breath
    const ng = t - 7.5;
    if (ng >= 0 && ng < 0.62) { const hx = vX(V, 234), hy = vY(V, 134), a = ng < 0.3 ? 1 : 1 - (ng - 0.3) / 0.32; z5Sunburst(hx, hy, 16, t * 0.5, 18 * V.z, (90 + 260 * eoc(ng / 0.4)) * a + 30, 0.11 * a, [110, 109, 108, 105, 109, 110, 104]); light(hx, hy, 340 * a, L_WARM, 0.75 * a); }
    const E = h5F(bE, tt, { form: 'hollow', frz, rim: t > 7.5 && t < 8.6 ? [-1, 0.2, 105] : undefined }, V);
    if (E) h5Ash(bE, tt, V, 16, 18, -34);
    const HR = h5F(bH, tt, { frz, rim: t < 7.5 ? [0.6, -0.8, 119] : undefined, dmg: D2 }, V);
    // the broken hilt spits light; then the light gathers
    if (t > 6.7 && t < 7.5) { const g = clip01(7.15, 7.5, t); for (let k = 0; k < 10 + 24 * g; k++) { const u = frac(ih(k, 1, 9230) + t * (1.6 + g * 2)), a = ih(k, 2, 9230) * TAU, r = g > 0 ? (1 - u) * 60 * V.z : u * 22 * V.z; if (bay(k, fl(t * 30)) < 0.9) { const px = HR.tip[0] + Math.cos(a) * r, py = HR.tip[1] + Math.sin(a) * r * (g > 0 ? 1 : 0.6) - (g > 0 ? 0 : u * 10); P(px, py, k % 3 ? 59 : 22); if (g > 0) P(px + Math.cos(a) * 2, py + Math.sin(a) * 2, 58); } } light(HR.tip[0], HR.tip[1], 26 + 60 * g, L_GOLD, 0.5 + 0.4 * g); }
    if (ng >= 0 && ng < 0.03) h5Impact(HR.x, HR.y, 0, [108, 109, 110, 73, 74, 104]);
    if (ng >= 0 && ng < 0.45) { shockRing(HR.x, HR.y, 12 + ng * 620, 8 + ng * 420, 4, [22, 109, 110], 1 - ng / 0.45); rocks(HR.x, HR.y + 30, ng, 10, 260, 3, [137, 136, 135, 22], 9231, 120); }
    // hero trail of sparks while it burns
    if (t > 7.5) for (let k = 0; k < 14; k++) { const age = frac(ih(k, 1, 9232) + t * 1.4) * 0.6, p = h5Trk(bH, tt - age), x = vX(V, p.x) + (ih(k, 2, 9232) - 0.5) * 50 * V.z, y = vY(V, p.y) + (ih(k, 3, 9232) - 0.3) * 30 * V.z - age * 40; if (bay(fl(x), fl(y)) < 1 - age / 0.6) P(x, y, k % 3 ? 109 : 22); }
    // clashes
    for (let k = 0; k < CL.length; k++) { const [h, x, y, d] = CL[k], g = t - h; if (g < 0 || g > 0.6) continue; h5Clash(vX(V, x), vY(V, y), g, k === 2 ? 0.9 : 1.15, d, 109, 74, 9240 + k); h5Spray(vX(V, x), vY(V, y), g, 0.8, d + (k & 1 ? 0.4 : -0.4), [22, 109], 9260 + k, ['dawn', 'ink', 'city']); if (k === 2 && g < 0.25) shockRing(vX(V, x), vY(V, y), 6 + g * 300, 6 + g * 300, 3, [22, 74, 72], 1 - g / 0.25); }
    // the lock: every shard bursts, the edges grind
    const lg = t - 10.6;
    if (lg >= 0) {
      const cx = vX(V, 923), cy = vY(V, lg < 0.2 ? lerp(100, 116, lg / 0.2) : 116 + z5Sh(t, 1) * 1.5);
      h5Blow(cx, cy, lg, 2.6, undefined, [22, 109, 74], 9250, 2, [72, 73, 74, 104, 107, 109, 110], L_WARM);
      if (lg > 0.05) { for (let k = 0; k < 34; k++) { const u = frac(ih(k, 1, 9251) + t * (2.2 + ih(k, 2, 9251) * 2)), sd = k & 1 ? 1 : -1, a = -PI / 2 + sd * (0.2 + ih(k, 3, 9251) * 1.3), v = (30 + ih(k, 4, 9251) * 90) * V.z * 0.5, px = cx + Math.cos(a) * v * u, py = cy + Math.sin(a) * v * u + 60 * u * u; if (bay(fl(px), fl(py)) < 1.1 - u) lineP(px, py, px - Math.cos(a) * 3, py - Math.sin(a) * 3 + 2, k % 3 === 0 ? 22 : sd > 0 ? 74 : 109); } sparkle(cx, cy, 4 + 3 * Math.sin(t * 40), 22, 140); light(cx, cy, 70 + 10 * Math.sin(t * 31), L_WH, 0.6); shk(1.2); }
    }
    b2Dec(t, V, true);
    // the next pane of the sky, coming at them: white paper behind it
    if (t > 11.2) { const u = eic(clip01(11.2, 11.6, t)), px = lerp(W + 30, 150, u), Wi = wview('ink'); polyF([[px, LB], [px + 5, LB], [px + 26, 150], [px + 64, H - LB], [px + 59, H - LB], [px + 21, 150]], () => 22); polyF([[px + 5, LB], [W, LB], [W, H - LB], [px + 64, H - LB], [px + 26, 150]], (x, y) => (bay(x, y) < 0.22 * u ? Wi[y * W + x] : -1)); light(px, 135, 120, L_WH, 0.5 * u); }
    if (V.r) z5Cam(1, V.r, 240, 135);
  }
  shot(5.4334, 11.6, (lt, t) => { b2Scene(t); });
  CAPS.push([6.6, 7.45, 's', 'HERO', 'NOT YOU TOO.'], [7.5, 8.45, 'x', '', 'ZENITH NOVA!', 58]);
  WORLDS.lock = () => { const V = b2View(11.6); b2Bg(11.6, V); };
  }

  /* ================================================================ ACT II — through the worlds (11.6–14.0)
     Still locked, they smash through three panes of the sky. 11.6 the white void: black ink line, a duck under a rising
     cut, a counter, ink for sparks. 12.6 the folded city: the hero runs up a flight of stairs and the Hollow runs along
     the underside of the flight above, upside down, their blades meeting in the gap as the two flights close. 13.4 the
     cathedral inside the dead sun: a thrust turned aside, a kick. */
  {
  /* ---------------------------------------------------------------- the white void */
  const iH = TR([
    { t: 11.6, x: 150, y: 132, sw: -1.25, S: 2, form: 'nova', a: 0, sq: 0, mouth: 0 },
    { t: 11.82, x: 112, y: 150, sw: -0.4, a: -0.2, e: 'o' },
    { t: 11.9, x: 116, y: 152, sw: 0.4, a: 0 },
    { t: 11.97, x: 140, y: 170, sq: 0.44, sw: 1.3, a: -0.15 },
    { t: 12.03, x: 152, y: 168, sq: 0.4, sw: 1.6 },
    { t: 12.12, x: 186, y: 140, sw: -0.9, sq: -0.16, a: 0.1, e: EQ },
    { t: 12.2, x: 176, y: 132, sw: -1.6, a: -0.5, sq: 0, e: 'o' },
    { t: 12.32, x: 208, y: 134, sw: -1.25, a: -6.283, sq: 0.05 },
    { t: 12.3201, a: 0 },
    { t: 12.7, x: 520, y: 128, vib: 0.6, e: 'i' },
  ]);
  const iE = TR([
    { t: 11.6, x: 212, y: 132, flip: true, sw: -1.25, S: 2, form: 'hollow', eyes: 'narrow', a: 0 },
    { t: 11.82, x: 366, y: 118, sw: 1.4, sq: 0.26, a: 0.1, e: 'o' },
    { t: 11.88, x: 368, y: 120, sw: 1.5, sq: 0.3 },
    { t: 11.97, x: 262, y: 140, sw: -1.2, sq: -0.14, a: -0.15, e: EQ },
    { t: 12.05, x: 256, y: 132, sw: -2.2, a: -0.25, sq: 0, e: 'o' },
    { t: 12.12, x: 300, y: 138, sw: -0.8, a: 0 },
    { t: 12.2, x: 318, y: 130, sw: -0.2, a: 0.4, e: 'o' },
    { t: 12.32, x: 270, y: 134, sw: -1.25, a: 6.283, sq: 0.05 },
    { t: 12.3201, a: 0 },
    { t: 12.7, x: 582, y: 128, vib: 0.6, e: 'i' },
  ]);
  const iView = (t) => { const kk = kick(t, [[11.6, 1.6, 0], [12.12, 1.3, -0.8]]), AF = h5Frame(iH, iE, Math.min(t, 12.3), { fill: 330, pad: 80, zmin: 1.5, zmax: 1.95, oy: -6 }), run = t > 12.3 ? (h5Trk(iH, t).x - 208) : 0; return { x: AF.x + run - kk[2], y: AF.y - kk[3], z: AF.z * (1 + kk[0]), r: kk[1] }; };
  const iBg = (t, V) => { w5Ink(t, (t - 11.6) * 60 + (V.x - 240) * 0.8, 0, {}); if (t > 12.3) { const u = clip01(12.3, 12.6, t); for (let k = 0; k < 30 * u; k++) { const y = LB + ih(k, 1, 9301) * (H - 2 * LB), x0 = ih(k, fl(t * 30), 9302) * W, L = 40 + ih(k, 3, 9301) * 160; lineF(x0, y, x0 + L, y, (X, Y, f) => { if (bay(X, Y) < 0.9 - Math.abs(f - 0.5) * 1.6) P(X, Y, 0); }); } } };
  function inkSplat(x, y, g, n, v, seed) { if (g < 0 || g > 0.7) return; for (let k = 0; k < n; k++) { const a = ih(k, 1, seed) * TAU, sp = v * (0.3 + ih(k, 2, seed)), px = x + Math.cos(a) * sp * g * (1 - g * 0.5), py = y + Math.sin(a) * sp * g * (1 - g * 0.5) + 160 * g * g, r = (1 + ih(k, 3, seed) * 3.2) * (1 - g * 0.9); discF(px, py, r, 0); if (k % 3 === 0) lineP(px, py, px - Math.cos(a) * 9 * (1 - g), py - Math.sin(a) * 9 * (1 - g), 0); } }
  shot(11.6, 12.6, (lt, t) => {
    const HS = [[11.6, 0.1], [12.12, 0.1]], V = iView(t), [tt, fz] = h5Clock(t, HS, 0.1, 2.2), frz = fz ? 1.4 : 0;
    GD.bloom = 0; GD.con = 0.1; GD.vig = 0.22; H5PX = 0; H5PY = 0;
    iBg(t, V);
    h5Shatter(WORLDS.lock, t - 11.6, 230, 130, { v: 420, dur: 0.5, grav: 60, delay: 0.0005 });
    inkSplat(vX(V, 180), vY(V, 132), t - 11.6, 26, 330, 9310);
    const E = h5F(iE, tt, { ink: true, frz }, V), HR = h5F(iH, tt, { ink: true, frz }, V);
    // brush marks where the blades met; ink for sparks
    const g = t - 12.12; if (g >= 0) { const cx = vX(V, 242), cy = vY(V, 107); inkSplat(cx, cy, g, 30, 300, 9311); if (g < 0.1) { thick(cx - 60 * (1 - g * 8), cy + 20, cx + 60 * (1 - g * 8), cy - 20, 3, 0); thick(cx - 16, cy - 40, cx + 16, cy + 40, 2, 0); } shk(4 * Math.max(0, 1 - g * 5)); }
    if (t > 12.32) { const cx = (E.x + HR.x) / 2, cy = HR.y - 34; for (let k = 0; k < 12; k++) { const u = frac(ih(k, 1, 9312) + t * 3), a = PI + (ih(k, 2, 9312) - 0.5) * 1.2; discF(cx + Math.cos(a) * 120 * u, cy + Math.sin(a) * 60 * u + 40 * u * u, 2 * (1 - u), 0); } }
    // the paper's edge, coming
    if (t > 12.45) { const u = eic(clip01(12.45, 12.6, t)), px = lerp(W + 20, 300, u), Wc = wview('city'); polyF([[px, LB], [W, LB], [W, H - LB], [px + 30, H - LB], [px - 16, 150], [px + 12, 90]], (x, y) => (x < px + 4 + Math.abs(((y * 7) % 23) - 11) * 0.6 ? 0 : bay(x, y) < 0.2 ? Wc[y * W + x] : -1)); }
    if (V.r) z5Cam(1, V.r, 240, 135);
  });
  WORLDS.inkEnd = () => { const V = iView(12.6); iBg(12.6, V); };

  /* ---------------------------------------------------------------- the folded city */
  const yA = (x) => 262 - 0.3 * (x + 40), yB = (x) => -4 + 0.1179 * (x + 80);
  const cHk = [], cEk = [];
  { // the run: built from the stairs themselves
    const S = 2.2, hx = (t) => lerp(196, 372, clip01(12.74, 13.4, t));
    cHk.push({ t: 12.6, x: 150, y: 80, a: 0.5, sw: -0.6, S, form: 'nova', sq: -0.1 }, { t: 12.74, x: 196, y: yA(196) - 26, a: 0, sq: 0.3, sw: 0.3, e: 'i' });
    cEk.push({ t: 12.6, x: 232, y: 60, a: 0, flip: true, sw: -0.6, S, form: 'hollow', eyes: 'narrow', sq: -0.1 }, { t: 12.76, x: 200, y: yB(200) + 37, a: PI, sq: 0.3, sw: 0.3, e: 'i' });
    for (const [tk, swH, swE, sq, ee] of [[12.84, 0.9, 0.9, 0, 'l'], [12.95, -1.15, -1.5, -0.12, EQ], [13.02, -2.3, -2.4, 0, 'o'], [13.1, 0.9, 1.0, 0.1, 'l'], [13.18, -1.2, -1.45, -0.12, EQ], [13.26, -2.2, -2.3, 0, 'o'], [13.4, -1.3, -1.3, 0.1, 'l']]) {
      const x = hx(tk); cHk.push({ t: tk, x, y: yA(x) - 26 - (tk === 12.95 || tk === 13.18 ? 5 : 0), sw: swH, sq, run: true, e: ee });
      cEk.push({ t: tk, x: x + 2, y: yB(x + 2) + 37 + (tk === 12.95 || tk === 13.18 ? 5 : 0), sw: swE, sq, run: true, e: ee });
    }
    cHk.push({ t: 13.6, x: 420, y: 96 }); cEk.push({ t: 13.6, x: 422, y: 84 });
  }
  const cH = TR(cHk), cE = TR(cEk);
  const cView = (t) => { const p = h5Trk(cH, t), kk = kick(t, [[12.6, 1.4, 0.4], [12.95, 1.1, -PI / 2], [13.18, 1.2, -PI / 2]]), u = eio(clip01(12.6, 12.8, t)); return { x: lerp(240, clamp(p.x + 44, 240, 420), u) - kk[2], y: lerp(135, (yA(p.x) + yB(p.x)) / 2 - 4, u) - kk[3], z: lerp(1.05, 1.36, u) * (1 + kk[0]), r: kk[1] * 0.6 }; };
  function cBg(t, V) {
    const ox = V.x - 240, oy = V.y - 135;
    w5City(t, ox * 0.9 + (t - 12.6) * 40, oy, {});
    // where the two flights meet: the dead sun, waiting
    const bx = vX(V, 432), by = vY(V, 92), r = (20 + 22 * eic(clip01(12.6, 13.4, t))) * V.z;
    blackSun(bx, by, r, t, 1);
    w5Flight(vX(V, -40), vY(V, 262), vX(V, 420), vY(V, 124), 10 * V.z, [126, 125, 129], false, t, 3, true);
    w5Flight(vX(V, -80), vY(V, -4), vX(V, 430), vY(V, yB(430)), 10 * V.z, [126, 125, 129], true, t, 4, true);
    for (let x = 0; x < W; x++) { const wx = (x - 240) / V.z + V.x; if (wx > 420) continue; const ya = vY(V, yA(wx)), yb = vY(V, yB(wx)); tintP(x, ya - 1, T_CYAN, 0.5); tintP(x, ya, T_CYAN, 0.6); tintP(x, yb, T_MAG, 0.35); tintP(x, yb + 1, T_MAG, 0.3); }
  }
  shot(12.6, 13.4, (lt, t) => {
    const HS = [[12.95, 0.1], [13.18, 0.1]], V = cView(t), [tt, fz] = h5Clock(t, HS, 0.1, 2), frz = fz ? 1.2 : 0;
    H5PX = V.x * 0.4; H5PY = 0;
    cBg(t, V);
    GD.bloom = 0; const gg = clip01(12.6, 12.75, t); GD.bloom = 0.3 * gg;
    h5Shatter(WORLDS.inkEnd, t - 12.6, 250, 130, { v: 420, dur: 0.45, grav: 80, delay: 0.0005 });
    const E = h5F(cE, tt, { frz, rim: [0, 1, 74], halo: 73 }, V), HR = h5F(cH, tt, { frz, dmg: (tq) => 0.36 }, V);
    h5Ash(cE, tt, V, 12, -60, 10);
    for (const [h, sd] of [[12.95, 9320], [13.18, 9321]]) { const g = t - h; if (g < 0 || g > 0.5) continue; const p = h5Trk(cH, h), cx = vX(V, p.x + 44), cy = vY(V, (yA(p.x) + yB(p.x)) / 2 + 4); h5Clash(cx, cy, g, 1.1, 0, 109, 74, sd); }
    for (let k = 0; k < 8; k++) { const u = frac(ih(k, 1, 9322) + t * 2.5); if (HR && bay(k, fl(t * 30)) < 1 - u) P(HR.x - 20 - u * 40, HR.y + 26 - u * 8 + (k % 3), k % 2 ? 128 : 15); }
    if (V.r) z5Cam(1, V.r, 240, 135);
  });
  WORLDS.cityEnd = () => { const V = cView(13.4); cBg(13.4, V); };

  /* ---------------------------------------------------------------- the cathedral inside the dead sun */
  const FL = 204;
  const kH = TR([
    { t: 13.4, x: 210, y: 120, a: -0.8, sw: -0.8, S: 2.2, form: 'nova', sq: 0 },
    { t: 13.52, x: 128, y: FL - 26, a: 0.12, sq: 0.3, sw: 0.4, e: 'o' },
    { t: 13.6, x: 118, y: FL - 26, a: 0, sq: 0.1, sw: 0.5 },
    { t: 13.66, x: 122, y: FL - 28, sw: -1.5, sq: -0.05, a: -0.1, e: EQ },                 // turns the thrust aside
    { t: 13.71, x: 126, y: FL - 28, sw: -2.2, a: -0.3, sq: 0.2, e: 'o' },
    { t: 13.77, x: 168, y: FL - 34, a: -1.05, lk: 1, sq: -0.2, sw: -2.4, e: EQ },          // the kick
    { t: 13.86, x: 160, y: FL - 28, a: -0.3, lk: 0, sq: 0.15, e: 'o' },
    { t: 14.0, x: 150, y: FL - 26, a: 0, sq: 0, sw: -0.5 },
  ]);
  const kE = TR([
    { t: 13.4, x: 270, y: 110, a: 0.8, flip: true, sw: -0.8, S: 2.2, form: 'hollow', eyes: 'narrow' },
    { t: 13.52, x: 372, y: FL - 31, a: -0.12, sq: 0.3, sw: 0.2, e: 'o' },
    { t: 13.58, x: 378, y: FL - 31, a: 0.1, sq: 0.3, sw: 0, reach: 0 },
    { t: 13.66, x: 252, y: FL - 32, a: -0.06, sq: -0.2, sw: -0.05, reach: 4, e: EQ },      // the thrust
    { t: 13.71, x: 240, y: FL - 33, sw: -0.9, reach: 1, a: -0.2, sq: 0, e: 'o' },         // its point thrown up
    { t: 13.77, x: 238, y: FL - 32, a: -0.2 },
    { t: 13.8, x: 244, y: FL - 30, sq: 0.36, a: 0.5, e: 'l' },                             // folded by the kick
    { t: 13.93, x: 318, y: FL - 31, sq: 0.1, a: 0.1, sw: 0.5, e: 'o' },
    { t: 14.0, x: 322, y: FL - 31, sq: 0, a: 0, sw: 0.6 },
  ]);
  for (const K0 of [kH, kE]) for (const k of K0) { k.x = 240 + (k.x - 240) * 1.12; k.y = FL - (FL - k.y) * 1.318; k.S = 2.9; }
  const kView = (t) => { const kk = kick(t, [[13.4, 1.4, 0], [13.66, 1.0, -1], [13.77, 1.8, 0]]); return { x: 240 - kk[2], y: 135 - kk[3], z: 1 + kk[0], r: kk[1] }; };
  shot(13.4, 14.0, (lt, t) => {
    const HS = [[13.66, 0.067], [13.77, 0.1]], V = kView(t), [tt, fz] = h5Clock(t, HS, 0.1, 2.4), frz = fz ? 1.3 : 0;
    H5PX = 0; H5PY = 0;
    w5Cath(t, (V.x - 240) * 2, 0, {});
    h5Shatter(WORLDS.cityEnd, t - 13.4, 240, 120, { v: 420, dur: 0.42, grav: 100, delay: 0.0005 });
    // their reflections in the floor, and the dust of the skid
    const E = h5F(kE, tt, { frz, rim: [0, -1, 103] }, V), HR = h5F(kH, tt, { frz, rim: [1, -0.3, 105], dmg: (tq) => 0.4 }, V);
    h5Ash(kE, tt, V, 12, 30, -30);
    for (const F of [E, HR]) if (F && t < 13.66) for (let k = 0; k < 10; k++) { const u = frac(ih(k, 1, 9330) + t * 4); if (bay(k, fl(t * 30)) < 1 - u) P(F.x + (F === HR ? 1 : -1) * (20 + u * 30) + (ih(k, 2, 9330) - 0.5) * 8, vY(V, FL) - u * 10, k % 2 ? 105 : 103); }
    let g = t - 13.66; if (g >= 0 && g < 0.5) h5Clash(vX(V, 191), vY(V, FL - 58), g, 1.0, -1.2, 109, 74, 9331);
    g = t - 13.77; if (g >= 0 && g < 0.6) { h5Blow(vX(V, 211), vY(V, FL - 34), g, 1.4, 0, [22, 109, 105], 9332, 0, null, L_WARM, ['cath', 'city', 'ink']); }
    if (V.r) z5Cam(1, V.r, 240, 135);
  });
  }

  /* ================================================================ ACT III — everything you spent (14.0–23.0)
     14.0 the Hollow copies: NOVA, inverted (a black star, white fire, wings of void), and its blade races out to colossal
     length. 15.0 it cuts the cathedral, and the dead sun in its window, clean in half; the halves slide apart on night.
     16.2 the hero blocks and is driven backward through a moon. 17.4 a wing is cut off from behind. 18.4 it is pinned to a
     slab of sky through the shoulder. 19.2 the mask, close. 20–23 the low point: four sparks, a hand closing on the blade. */
  {
  // a black star: a hole with a corona of white fire
  function blackStar(cx, cy, r, t, amt) {
    if (amt <= 0.02 || r < 1) return;
    const R = r * 2.6, x0 = Math.max(0, fl(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R)), y0 = Math.max(LB, fl(cy - R)), y1 = Math.min(H - LB - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy), an = Math.atan2(dy, dx);
      if (d < r) { BUF[y * W + x] = d > r - 1.5 ? 22 : d > r - 3 ? 20 : ih(x, y, 9401) < 0.01 ? 57 : 0; continue; }
      const tongue = r * (1.12 + 0.75 * Math.max(0, Math.sin(an * 7 + t * 2.6) * Math.sin(an * 3 - t * 1.3)) + 0.4 * vn(an * 4 + t * 1.4, 0, 1, 9402)) * amt;
      if (d < tongue) { const e = (d - r) / Math.max(1, tongue - r); BUF[y * W + x] = e < 0.25 ? 22 : e < 0.5 ? 21 : e < 0.75 ? 20 : bay(x, y) < 0.5 ? 19 : 62; }
    }
    light(cx, cy, r * 4, L_DARK, 0.45 * amt); light(cx, cy, r * 2.4, L_COLD, 0.5 * amt);
  }
  // the smear of a colossal blade swept about (hx, hy) from angle a0 to a1
  function bladeFan(hx, hy, a0, a1, len, edge) {
    let d = a1 - a0; const ad = Math.abs(d); if (ad < 0.05) return;
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy, r = Math.sqrt(dx * dx + dy * dy); if (r > len || r < 14) continue;
      let rel = Math.atan2(dy, dx) - a0; rel = d > 0 ? ((rel % TAU) + TAU) % TAU : ((-rel % TAU) + TAU) % TAU; if (rel > ad) continue;
      const u = rel / ad; if (bay(x, y) > u * u * 1.2 - 0.05) continue;
      BUF[y * W + x] = u > 0.94 ? 22 : u > 0.86 ? edge : (ih(x, y, 9403) < 0.01 ? 57 : u > 0.6 ? 0 : 77);
    }
  }
  /* ---------------------------------------------------------------- 14.0–16.2: NOVA., and the world cut in half */
  const D4 = (t) => clamp(0.42 + 0.1 * (t >= 15) + 0.15 * (t >= 16.2) + 0.2 * (t >= 17.4) + 0.13 * (t >= 18.4), 0, 1);
  const FL = 204;
  const nE = TR([
    { t: 14.0, x: 240, y: 160, S: 2.2, flip: true, form: 'hnova', nosw: true, arm: -0.4, sq: -0.26, spread: 0.1, aur: 2.4, eyes: 'wide', a: 0 },
    { t: 14.3, x: 240, y: 128, sq: 0, spread: 1.3, aur: 1.5, arm: -0.8, e: 'o' },
    { t: 14.5, x: 240, y: 126, spread: 1, aur: 1.15, eyes: 'narrow' },
    { t: 14.86, x: 244, y: 118, a: 0.22, arm: -1.1, sq: 0.1 },
    { t: 14.96, x: 246, y: 116, a: 0.3, sq: 0.18 },
    { t: 15.0, x: 232, y: 132, a: -0.3, arm: 0.7, sq: -0.2, e: EQ },
    { t: 15.25, x: 230, y: 136, a: -0.34, sq: 0, e: 'o' },
    { t: 15.6, x: 250, y: 124, a: 0, arm: -0.2 },
    { t: 15.95, x: 306, y: 116, a: 0.28, arm: -0.2, sq: 0.16 },
    { t: 16.13, x: 310, y: 116, a: 0.32, sq: 0.2 },
    { t: 16.2, x: 286, y: 124, a: -0.3, arm: 0.5, sq: -0.2, e: EQ },
    { t: 16.4, x: 280, y: 126 },
  ]);
  const nH = TR([
    { t: 14.0, x: 92, y: FL - 26, S: 2.2, form: 'nova', sw: -0.5, a: 0, eyes: 'glow', sq: 0 },
    { t: 14.25, x: 78, y: FL - 26, a: -0.16, sw: -1.3, sq: 0.12, e: 'o' },
    { t: 14.92, x: 70, y: FL - 26, a: -0.2, sq: 0.22, sw: -1.4 },
    { t: 14.96, x: 70, y: FL - 24, sq: 0.36 },
    { t: 15.0, x: 96, y: 112, a: 0.3, sq: -0.22, sw: -0.6, e: 'o' },
    { t: 15.3, x: 108, y: 104, a: 0, sq: 0, sw: -0.9 },
    { t: 15.9, x: 126, y: 124, sw: -1.3 },
    { t: 16.12, x: 130, y: 128, sw: -1.55, reach: 2, sq: 0.16, a: -0.1 },
    { t: 16.2, x: 120, y: 126, sq: 0.32, a: -0.25, e: 'l' },
    { t: 16.3, x: -120, y: 106, e: 'l' },
  ]);
  const bladeA = (t) => t < 14.5 ? lerp(-2.3, -2.0, clip01(14.0, 14.5, t)) : t < 14.9 ? lerp(-2.0, -1.15, eio(clip01(14.5, 14.9, t))) : t < 14.94 ? -1.15 : t < 14.97 ? -1.3 : t < 15.0 ? -1.95 : t < 15.3 ? -3.6 : t < 15.95 ? lerp(-3.6, -0.25, eio(clip01(15.3, 15.95, t))) : t < 16.14 ? -0.25 + 0.06 * Math.sin(t * 40) : t < 16.17 ? 0.5 : t < 16.2 ? 1.7 : 2.96;
  const bladeL = (t) => t < 14.5 ? 300 * eoc(clip01(14.05, 14.5, t)) : lerp(300, 900, eio(clip01(14.5, 14.9, t)));
  const CUT = [210, 120, -0.897, 0.443];                    // the line the world is cut along: a point, a direction
  function nCath(t, fire) { w5Cath(t, 0, 0, { fire }); }
  function nScene(t) {
    const HS = [[14.0, 0.1], [15.0, 0.134], [16.2, 0.134]], [tt, fz] = h5Clock(t, HS, 0.1, 2.6), frz = fz ? 1.6 : 0;
    const zb = lerp(1.32, 1, eio(clip01(14.25, 14.9, t))), kk = kick(t, [[14.0, 2, -PI / 2], [15.0, 2.6, 2.6], [16.2, 2.4, PI]]);
    const V = { x: lerp(232, 200, eio(clip01(14.25, 14.9, t))) - kk[2], y: lerp(122, 135, eio(clip01(14.25, 14.9, t))) - kk[3], z: zb * (1 + kk[0]) };
    const fire = lerp(1, 0.22, eoc(clip01(14.0, 14.5, t))), sg = t - 15.0;
    H5PX = 0; H5PY = 0;
    if (sg < 0) { nCath(t, fire); z5Cam(V.z, 0, V.x, V.y, 240, 135); }
    else {
      // the halves of the cathedral slide apart; between them the night, and a moon
      w5Night(t, 0, 0, { moon: [128, 150, 40] });
      H5NEW.set(BUF); nCath(t, 0.22); H5OLD.set(BUF); BUF.set(H5NEW); LIGHTS.length = 0;
      const gap = 170 * eoc(clip01(0.02, 1.15, sg)) + 6 * sg, [lx, ly, ux, uy] = CUT, nx = -uy, ny = ux;   // n points down-left... the sign is taken per side below
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
        const d = (x - lx) * nx + (y - ly) * ny, sd = d > 0 ? 1 : -1, sx = x - nx * sd * gap * 0.5 - ux * sd * gap * 0.22, sy = y - ny * sd * gap * 0.5 - uy * sd * gap * 0.22;
        const ds = (sx - lx) * nx + (sy - ly) * ny; if (ds * sd <= 0) continue;
        const X = fl(sx), Y = fl(sy); if (X < 0 || X >= W || Y < LB || Y >= H - LB) continue;
        BUF[y * W + x] = Math.abs(ds) < 1.6 ? 22 : Math.abs(ds) < 3.2 ? 20 : H5OLD[Y * W + X];
      }
      light(lx, ly, 260 * Math.max(0, 1 - sg * 2), L_COLD, 0.7);
      rocks(lx - 40, ly + 20, sg, 22, 260, 6, [96, 98, 100, 103], 9410, 140);
    }
    const E0 = h5Pose(nE, tt), ex = vX(V, E0.x), ey = vY(V, E0.y);
    blackStar(ex, ey - 4 * V.z, 26 * V.z * eob(clip01(14.0, 14.35, t)), t, 1);
    // the hero, braced in the wind of it
    const HR = h5F(nH, tt, { frz, rim: [1, -0.2, 20], dmg: D4 }, V);
    if (t < 15) for (let k = 0; k < 30; k++) { const u = frac(ih(k, 1, 9411) + t * 2.2), a = PI + (ih(k, 2, 9411) - 0.5) * 1.6, r = 30 + u * 260; if (bay(k, fl(t * 30)) < 1 - u) P(ex + Math.cos(a) * r, ey + Math.sin(a) * r * 0.6, k % 3 ? 20 : 22); }
    // the blade
    const ba = bladeA(t), bl = bladeL(t) * V.z, bw = lerp(3, 8, clip01(14.0, 14.9, t)) * V.z;
    const E = h5F(nE, tt, { frz }, V);
    const bh = [E.hand[0] - 3 * V.z, E.hand[1]];
    if (t > 14.03) {
      if (t >= 14.96 && t < 15.1) bladeFan(bh[0], bh[1], bladeA(t - 1 / 30) > -1.2 ? -1.15 : bladeA(t - 1 / 30), ba - (t >= 15 ? 0 : 0), 900, 74);
      if (t >= 16.14 && t < 16.3) bladeFan(bh[0], bh[1], -0.25, ba, 900, 74);
      bigBlade(bh[0], bh[1], ba, bl, bw, t, { form: 'void', grow: t < 14.9 ? 0.999 : 1, flare: 0.7, surge: t < 14.97 });
      // where it goes out through the vault
      if (t > 14.3 && t < 14.97) { const ty = LB + 2, k2 = (ty - bh[1]) / Math.sin(ba), tx = bh[0] + Math.cos(ba) * k2; if (k2 > 0 && k2 < bl) { rocks(tx, ty, frac(t * 2.5) * 0.4, 6, 120, 3, [96, 98, 100, 103], 9412 + fl(t * 2.5), 300, PI / 2, 1.6); light(tx, ty + 6, 40, L_WH, 0.6); } }
    }
    h5Ash(nE, tt, V, 18, 30, -40, [0, 78, 20, 0, 22, 77]);
    if (t < 14.5) { const g = t - 14.0; h5Heavy(ex, ey, g, 2.2, undefined, [22, 20, 62], 9413, 1, [73, 74, 104, 107], L_COLD); }
    if (sg >= 0) { const [lx, ly, ux, uy] = CUT; h5Blow(lx + ux * 60, ly + uy * 60, sg, 3, Math.atan2(uy, ux), [22, 20, 74], 9414, 1, [72, 73, 74, 104, 107], L_COLD, ['cath', 'night', 'dawn']); if (sg < 0.4) for (let k = -6; k <= 6; k++) { const px = lx + ux * k * 60, py = ly + uy * k * 60; if (bay(k + 8, 3) < 1 - sg * 2.5) sparkle(px, py, 10 * (1 - sg / 0.4), 22, 20); } }
    const bg = t - 16.2;
    if (bg >= 0) h5Blow(HR ? HR.x + 30 : 150, HR ? HR.y : 126, bg, 2.8, PI, [22, 109, 74], 9415, 2, [72, 73, 74, 104, 107, 109, 110], L_WARM);
    if (kk[1]) z5Cam(1, kk[1], 240, 135);
  }
  shot(14.0, 16.2334, (lt, t) => nScene(t));
  CAPS.push([14.0, 14.9, 'x', 'inv', 'NOVA.', 208]);

  /* ---------------------------------------------------------------- 16.2–18.4: through the moon; the wing; pinned */
  const SLY = 350, MOON = [250, 118, 50];
  const mH = TR([
    { t: 16.2, x: 500, y: 128, S: 1.7, form: 'nova', a: -0.35, sw: -1.5, reach: 2, sq: 0.25, eyes: 'closed', mouth: 2, cr: 0.3 },
    { t: 16.3, x: 300, y: 124, e: 'l' },
    { t: 16.38, x: 200, y: 122, a: -1.6, reach: 0, e: 'l' },
    { t: 16.72, x: 176, y: 138, a: -6.5, sq: 0, e: 'o' },
    { t: 16.7201, a: -0.217 },
    { t: 16.98, x: 172, y: 140, a: 0, sw: -0.7, eyes: 'glow', mouth: 1, cr: 0.45 },
    { t: 17.28, x: 174, y: 141, vib: 0.5 },
    { t: 17.34, x: 174, y: 140, eyes: 'wide', a: 0.1 },
    { t: 17.4, x: 184, y: 148, a: 0.5, sq: 0.3, wl: 1, vib: 0, e: 'l' },
    { t: 17.4001, wl: 0, mouth: 2, eyes: 'closed', cr: 0.6 },
    { t: 17.64, x: 214, y: 176, a: 0.9, sq: -0.15, noAfter: true, e: 'o' },
    { t: 18.0, x: 252, y: SLY - 21, a: 0.1, sq: 0.48, sw: 0.4, e: 'i' },
    { t: 18.0001, a: 0.1 },
    { t: 18.1, x: 262, y: SLY - 46, a: 0.5, sq: -0.05, noAfter: false, e: 'o' },
    { t: 18.2, x: 270, y: SLY - 19, a: 0.12, sq: 0.34, e: 'i' },
    { t: 18.34, x: 270, y: SLY - 24, a: -0.05, sq: 0.1, vib: 0.5, eyes: 'narrow', mouth: 1, spread: 0.7 },
    { t: 18.4, x: 272, y: SLY - 18, a: 0.12, sq: 0.36, eyes: 'closed', mouth: 2, cr: 0.85, vib: 0, e: 'l' },
    { t: 18.6, x: 272, y: SLY - 18 },
  ]);
  const mE = TR([
    { t: 16.2, x: 620, y: 110, S: 1.7, flip: false, form: 'hnova', nosw: true, arm: -1.2, hide: true, a: 0 },
    { t: 17.0, x: 330, y: 20, hide: false, a: -0.2 },
    { t: 17.08, x: 104, y: 62, a: -0.34, sq: 0.16, e: 'o' },
    { t: 17.34, x: 100, y: 58, a: -0.42, sq: 0.22 },
    { t: 17.4, x: 114, y: 86, a: 0.3, arm: 0.9, sq: -0.2, e: EQ },
    { t: 17.58, x: 118, y: 94, a: 0.34, sq: 0, e: 'o' },
    { t: 18.0, x: 228, y: 196, a: 0, arm: 1.2 },
    { t: 18.3, x: 236, y: 236, arm: 1.3, sq: 0.16, a: -0.1 },
    { t: 18.4, x: 238, y: 262, sq: -0.16, a: 0.05, e: EQ },
    { t: 18.6, x: 238, y: 261, sq: 0 },
  ]);
  const mBladeA = (t) => t < 17.36 ? -1.05 + 0.04 * Math.sin(t * 30) : t < 17.38 ? -0.2 : t < 17.6 ? 1.0 : t < 18.3 ? lerp(1.0, 1.31, eio(clip01(17.6, 18.2, t))) : 1.31;
  const mBladeL = (t) => t < 17.5 ? 420 : lerp(420, 62, eio(clip01(17.5, 18.1, t)));
  const mView = (t) => {
    const kk = kick(t, [[16.3, 1.6, PI], [17.4, 2.2, 1.2], [18.0, 1.2, PI / 2], [18.4, 2.4, PI / 2]]), p = h5Trk(mH, Math.max(t, 17.4));
    const a = eio(clip01(16.42, 16.9, t)), b = eio(clip01(17.45, 18.0, t));
    return { x: lerp(lerp(240, lerp(176, 150, clip01(16.9, 17.3, t)), a), 250, b) - kk[2], y: lerp(lerp(128, lerp(132, 106, clip01(16.9, 17.3, t)), a), lerp(296, 300, clip01(18.0, 18.4, t)), b) - kk[3], z: lerp(lerp(1, 2.0, a), 1.38, b) * (1 + kk[0]), r: kk[1] };
  };
  function mBg(t, V) {
    w5Night(t, V.x * 0.25, V.y * 0.25, {});
    // the moon: whole, then tunnelled, then in halves, drifting apart
    const mx = vX(V, MOON[0]), my = vY(V, MOON[1]), r = MOON[2] * V.z, g = t - 16.3;
    if (g < 0) w5Moon(mx, my, r);
    else {
      const hb = 16 * V.z * clip01(0, 0.08, g), d = 46 * V.z * eoc(clip01(0.04, 1.4, g)), jag = (dx) => (vn(dx, 0, 7, 9420) - 0.5) * 12;
      w5Moon(mx - d * 0.25, my - d * 0.5, r, (dx, dy) => dy < -hb + jag(dx) - dx * 0.04);
      w5Moon(mx + d * 0.2, my + d * 0.5, r, (dx, dy) => dy > hb + jag(dx + 40) - dx * 0.04);
      rocks(mx, my, g, 30, 170 * V.z, 8 * V.z, [17, 18, 19, 20], 9421, 30, PI, 2.6);
      rocks(mx, my, g * 0.7, 40, 90 * V.z, 3 * V.z, [18, 19, 20, 21], 9422, 20);
      if (g < 0.5) { shockRing(mx, my, 10 + g * 380, 10 + g * 380, 3, [22, 20, 19], 1 - g / 0.5); light(mx, my, 200 * (1 - g * 2), L_COLD, 0.8); }
    }
    h5Shard(slabPts(vX(V, 150), vX(V, 372), vY(V, SLY), 0, 44 * V.z, 31), 'dawn', 250, 120, t, { th: 4, seed: 31 });
  }
  function mScene(t) {
    const HS = [[16.3, 0.134], [17.4, 0.167], [18.0, 0.067], [18.4, 0.167]], V = mView(t), [tt, fz] = h5Clock(t, HS, 0.1, 2.8), frz = fz ? 1.6 : 0;
    H5PX = V.x * 0.3; H5PY = V.y * 0.3;
    mBg(t, V);
    // the sweep that sent it, passing
    if (t < 16.4) { const g = t - 16.2; bladeFan(W + 200, vY(V, 126), PI + 0.5 - g * 2, PI + 0.05 - g * 0.2, 900, 74); }
    const wg = t - 17.4;
    // the wing that was cut off: it spins away, burning out
    if (wg >= 0 && wg < 1.1) { const wx = vX(V, 160 - 90 * wg - 30 * wg * wg), wy = vY(V, 128 - 80 * wg + 150 * wg * wg), burn = clip01(0.1, 1.0, wg); h5Wing(wx, wy, 1.7 * 0.55 * V.z, t, 1, 0.1, -1, 'nova', -wg * 6, 0, 0, burn); light(wx - 14, wy - 10, 60 * (1 - burn), L_WARM, 0.6 * (1 - burn)); for (let k = 0; k < 16; k++) { const u = frac(ih(k, 1, 9430) + t * 2); if (bay(k, fl(t * 30)) < (1 - u) * (1 - burn * 0.6)) P(wx - 20 + (ih(k, 2, 9430) - 0.5) * 40 + u * 20, wy - 10 + (ih(k, 3, 9430) - 0.5) * 30 - u * 26, k % 3 ? 105 : 109); } }
    // the Hollow arrives behind it: its eyes get there first
    if (t > 16.94 && t < 17.12) { const u = clip01(16.94, 17.08, t), ax = vX(V, lerp(520, 104, eoc(u))), ay = vY(V, lerp(-10, 60, eoc(u))); for (const [c, o] of [[74, -4], [104, 5]]) lineF(vX(V, 520), vY(V, -10) + o, ax, ay + o, (X, Y, f) => { if (bay(X, Y) < f * 1.2 - (t > 17.08 ? (t - 17.08) * 20 : 0)) P(X, Y, c); }); }
    const E = h5F(mE, tt, { frz }, V);
    if (E) {
      const ba = mBladeA(t), bh = [E.hand[0] + 3 * V.z, E.hand[1]];
      if (t >= 17.36 && t < 17.5) bladeFan(bh[0], bh[1], -1.05, ba, 520 * V.z, 74);
      bigBlade(bh[0], bh[1], ba, mBladeL(t) * V.z, lerp(6, 3.4, clip01(17.5, 18.1, t)) * V.z, t, { form: 'void', flare: 0.6 });
      h5Ash(mE, tt, V, 14, 20, -40, [0, 78, 20, 0, 22, 77]);
    }
    const HR = h5F(mH, tt, { frz, rim: [-0.6, -0.6, 20], dmg: D4 }, V);
    // light bleeding from the stump of the wing
    if (wg > 0 && t < 18.4) for (let k = 0; k < 14; k++) { const age = frac(ih(k, 1, 9431) + t * 1.8) * 0.5, p = h5Trk(mH, tt - age), x = vX(V, p.x - 8) + (ih(k, 2, 9431) - 0.5) * 12, y = vY(V, p.y - 14) + (ih(k, 3, 9431) - 0.5) * 10 - age * 30; if (bay(fl(x), fl(y)) < 1 - age * 2) { P(x, y, k % 2 ? 22 : 109); P(x, y - 1, 105); } }
    if (wg >= 0) (wg < 0.45 ? h5Blow : h5Heavy)(vX(V, 160), vY(V, 128), wg, 2.4, 1.0, [22, 109, 105], 9432, 1, [72, 73, 74, 104, 107, 109, 110], L_WARM);
    let g = t - 18.0; if (g >= 0 && g < 0.6) { h5Heavy(vX(V, 252), vY(V, SLY), g, 1.0, -PI / 2, [22, 135, 136], 9433, 0, null, L_COLD); rocks(vX(V, 252), vY(V, SLY), g, 5, 140, 3, [137, 136, 135, 22], 9434, 200, -PI / 2, 2); }
    g = t - 18.4; if (g >= 0) { h5Blow(vX(V, 262), vY(V, SLY - 20), g, 2.6, PI / 2, [22, 109, 74], 9435, 1, [72, 73, 74, 104, 107], L_WARM); }
    if (V.r) z5Cam(1, V.r, 240, 135);
  }
  shot(16.2334, 18.4334, (lt, t) => mScene(t));

  /* ---------------------------------------------------------------- the pin (18.4–19.2, 20.0–21.5, 22.3–23.0) */
  const PH = [276, 181], HILT = [224, 70], TIP = [262, 216], PSL = 210, SPK = [20.4, 20.9, 21.4, 21.9];
  const SPT = [[262, 170], [292, 186], [276, 166], [246, 150]];                              // where each spark touches
  // o: flick (the nova guttering), up 0..1 (it pulls itself up the blade), grip 0..1, drain 0..1, hz 0..1, eEyes
  function pinScene(t, V, o) {
    H5PX = V.x * 0.3; H5PY = V.y * 0.3;
    w5Night(t, 40 + V.x * 0.2, 60 + V.y * 0.2, {});
    // the broken moon, far behind now
    { const mx = vX(V, 96) * 0.6 + 60, my = vY(V, 70) * 0.5 + 30; w5Moon(mx - 6, my - 9, 22, (dx, dy) => dy < -3 + (vn(dx, 0, 5, 9420) - 0.5) * 6); w5Moon(mx + 5, my + 10, 22, (dx, dy) => dy > 3 + (vn(dx + 40, 0, 5, 9420) - 0.5) * 6); for (let k = 0; k < 10; k++) { const a = ih(k, 1, 9440) * TAU, r = 20 + ih(k, 2, 9440) * 30 + t * 0.6; discF(mx + Math.cos(a) * r, my + Math.sin(a) * r * 0.7, 1 + ih(k, 3, 9440) * 2.5, k % 2 ? 18 : 19); } }
    // first light, far off: the line where the night ends
    if (o.hz > 0) { const hy = vY(V, 190); for (let x = 0; x < W; x++) { if (bay(x, hy) < o.hz * 1.2) P(x, hy, o.hz > 0.6 ? 140 : 141); if (o.hz > 0.5 && bay(x, hy + 1) < (o.hz - 0.5) * 2) P(x, hy - 1, 141); } light(240, hy, 240, L_GOLD, 0.25 * o.hz); }
    h5Shard(slabPts(vX(V, 110), vX(V, 410), vY(V, PSL), 0, 50 * V.z, 31), 'dawn', 250, 120, t, { th: 5, seed: 31 });
    // cracks in the slab round the point
    { const cx = vX(V, TIP[0]), cy = vY(V, PSL + 2); for (let k = 0; k < 7; k++) { let a = PI * (0.08 + k * 0.14), x = cx, y = cy; for (let q = 0; q < 4; q++) { const nx = x + Math.cos(a) * 9 * V.z, ny = y + Math.abs(Math.sin(a)) * 5 * V.z; lineP(x, y, nx, ny, q < 2 ? 22 : 135); x = nx; y = ny; a += (ih(k, q, 9441) - 0.5) * 0.9; } } }
    const z = V.z, up = o.up || 0, drain = o.drain || 0, sh = (o.shake || 0);
    // the Hollow over it, pressing the blade down
    const eK = TR([{ t: 0, x: 176 - 3 * drain, y: 76 + Math.sin(t * 1.3) * 2 - 4 * drain, S: 3, form: 'hnova', nosw: true, arm: 0.5, a: 0.14, eyes: o.eEyes || 'narrow', spread: 1, flap: 0.14, aur: 1.1 - 0.5 * drain, glow: 1 - 0.5 * drain }, { t: 100, x: 176 - 3 * drain, y: 76 + Math.sin(t * 1.3) * 2 - 4 * drain }]);
    const E = h5F(eK, t, {}, V);
    // the blade, through the shoulder into the slab
    const hx = E.hand[0] + 5 * z, hy = E.hand[1] + 2 * z, tx = vX(V, TIP[0]), ty = vY(V, TIP[1]), ba = Math.atan2(ty - hy, tx - hx), bl = Math.hypot(tx - hx, ty - hy);
    bigBlade(hx, hy, ba, bl, 5 * z * (1 - 0.25 * drain), t, { form: 'void', flare: 0.5 * (1 - drain), cracks: drain * 2.4 });
    // its darkness running down into the hero
    if (drain > 0) for (let k = 0; k < 40 * drain; k++) { const u = frac(ih(k, 1, 9442) + t * (1.2 + ih(k, 2, 9442))), q = (ih(k, 3, 9442) - 0.5) * 8 * z, px = hx + Math.cos(ba) * bl * u - Math.sin(ba) * q, py = hy + Math.sin(ba) * bl * u + Math.cos(ba) * q; lineP(px, py, px - Math.cos(ba) * 6 * z, py - Math.sin(ba) * 6 * z, k % 3 ? 22 : 74); }
    // the hero
    const flick = o.flick !== undefined && o.flick > 0 && (fl(t * 22) % 3 !== 0 || o.flick > 0.7), lit = o.lit || 0;
    const hK = TR([{ t: 0, x: PH[0] + z5Sh(t, 3) * sh, y: PH[1] - 5 * up + z5Sh(t, 5) * sh * 0.6 + Math.sin(t * 1.5) * 0.5, S: 3, form: flick ? 'nova' : 'plain', swst: 'stub', swl: 9, sw: 0.5 + 0.1 * Math.sin(t * 0.7), a: 0.3 - 0.26 * up, sq: 0.34 - 0.2 * up + Math.sin(t * 1.5) * 0.025, cr: flick ? 0.6 : 1, eyes: o.eyes || 'closed', mouth: o.mouth || 0, spread: 0, aur: o.flick || 0, glow: o.flick || 0, dim: flick ? 0 : Math.max(0, 0.42 - lit * 0.42), nobob: true, arm2: o.grip ? [-2.25 + 0.2 * (1 - o.grip), 4 + 6 * o.grip, 1] : null, legs: up > 0.5 ? [1, 0, 0, 1] : [5, 4, 5, 5] }, { t: 100, x: PH[0], y: PH[1] }]);
    const HR = h5F(hK, t, { rim: lit > 0.05 ? [0.5, -0.8, 60] : undefined, noLight: !flick }, V);
    // where the blade goes in
    { const wx = vX(V, PH[0] - 31), wy = vY(V, PH[1] - 24 - 5 * up); sparkle(wx, wy, 3 + Math.sin(t * 9) * 1.2, flick ? 22 : 107, 103); light(wx, wy, 26, L_CRIM, 0.5); for (let k = 0; k < 5; k++) { const u2 = frac(ih(k, 1, 9443) + t * 0.9); if (bay(k, fl(t * 30)) < 1 - u2) P(wx + (ih(k, 2, 9443) - 0.5) * 8, wy + u2 * 16, k & 1 ? 107 : 103); } }
    // the sparks: drifting in, touching, going into it
    for (let k = 0; k < 4; k++) {
      const g = t - SPK[k], sx = vX(V, SPT[k][0]), sy = vY(V, SPT[k][1] - 5 * up);
      if (g < -1.6) continue;
      if (g < 0) { const u = 1 + g / 1.6, e = eio(u), a0 = k * 1.9 + 0.6, ox = Math.cos(a0) * 230 * (1 - e) + Math.sin(u * 5 + k) * 14 * (1 - u), oy = Math.sin(a0) * 120 * (1 - e) - 30 * Math.sin(u * PI), x = sx + ox, y = sy + oy; for (let q = 1; q < 7; q++) { const u2 = Math.max(0, u - q * 0.02), e2 = eio(u2); if (bay(q, k + fl(t * 30)) < 1 - q / 7) P(sx + Math.cos(a0) * 230 * (1 - e2) + Math.sin(u2 * 5 + k) * 14 * (1 - u2), sy + Math.sin(a0) * 120 * (1 - e2) - 30 * Math.sin(u2 * PI), ORB[k][q < 3 ? 2 : 1]); } light(x, y, 22, [L_COLD, [0.5, 1, 0.4], L_GOLD, L_VIO][k], 0.6); discF(x, y, 3.4, 63); discF(x, y, 2.6, ORB[k][1]); discF(x - 0.8, y - 0.8, 1.4, ORB[k][2]); P(x - 1, y - 1, 22); }
      else if (g < 0.9) { shockRing(sx, sy, 3 + g * 70, 3 + g * 70, 2, [22, ORB[k][2], ORB[k][1]], 1 - g / 0.5); light(sx, sy, 80 * Math.max(0.2, 1 - g), [L_COLD, [0.5, 1, 0.4], L_GOLD, L_VIO][k], 0.75 * (1 - g / 0.9)); if (g < 0.1) sparkle(sx, sy, 7 * (1 - g / 0.1), 22, ORB[k][2]); }
    }
    return { H: HR, E, hx, hy, ba, bl };
  }
  shot(18.4334, 19.2, (lt, t) => {
    const kk = kick(t, [[18.4, 2, PI / 2]]), u = eio(clip01(18.5, 19.2, t)), V = { x: lerp(250, 222, u) - kk[2], y: lerp(146, 118, u) - kk[3], z: lerp(1.0, 1.16, u) * (1 + kk[0]) };
    pinScene(t, V, { flick: 1 - clip01(18.4, 18.95, t), shake: 2.5 * (1 - clip01(18.4, 18.8, t)), eyes: 'closed', mouth: t < 18.7 ? 2 : 0 });
    const g = t - 18.4; if (g < 0.5) { GD.ca = Math.max(GD.ca, 3 * (1 - g / 0.5)); rocks(vX(V, TIP[0]), vY(V, PSL), g, 12, 200, 3.5, [137, 136, 135, 22], 9450, 240, -PI / 2, 2.4); }
    GD.mul = [1 - 0.12 * u, 1 - 0.12 * u, 1 - 0.06 * u];
  });

  /* ---------------------------------------------------------------- 19.2–20.0: the half-mask, close */
  function hollowFace(t, s, cx, cy) {
    // the body, turned to us: 26 × 16 units of night, the mask over the right half
    const bw = 26 * s, bh = 16 * s, x0 = cx - bw / 2, y0 = cy - bh / 2, f6 = fl(t * 6);
    w5Night(t, 30, 20, { noShards: true });
    light(cx, cy, 300, L_DARK, 0.5);
    // white fire off its edge
    for (let x = fl(x0 - 14); x < x0 + bw + 14; x++) { const hgt = 10 + 40 * vn(x * 0.09, t * 3.4, 1, 9460) * vn(x * 0.31, t * 5, 1, 9461) * 2; for (let q = 0; q < hgt; q++) { const u = q / hgt, y = y0 - q; if (y < LB) break; if (bay(x, fl(y)) < 1.15 - u) P(x, y, u < 0.2 ? 0 : u < 0.45 ? 22 : u < 0.7 ? 20 : 62); } }
    const X0 = Math.max(0, fl(x0)), X1 = Math.min(W - 1, fl(x0 + bw)), Y0 = Math.max(LB, fl(y0)), Y1 = Math.min(H - LB - 1, fl(y0 + bh));
    const lim = (v) => 13.4 + Math.sin(v * 1.9) * 1.3 + (vn(v * 2.2, 0, 1, 9462) - 0.5) * 3.2 - (v > 10 ? (v - 10) * 1.6 : 0), mh = 12.6;
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const u = (x - x0) / s, v = (y - y0) / s, um = 26 - u, i = y * W + x;
      const e = Math.min(u, v, 26 - u, 16 - v);
      let c;
      if (e < 0.22 + 0.1 * Math.sin(x * 0.7 + t * 9)) c = 22; else if (e < 0.5 && ((x + y + fl(t * 10)) & 1)) c = 20;
      else { const h = ih(x, y, 9463); if (h < 0.012) { const tw = ih(x, y, 9464 + f6); c = h < 0.003 ? 22 : tw < 0.5 ? 57 : h < 0.007 ? 56 : 75; } else { const n = vn(x + t * 2, y, 26, 9465) + vn(x, y - t, 9, 9466) * 0.3; c = n > 0.86 ? 79 : n > 0.72 ? 78 : n > 0.58 ? 77 : n < 0.3 ? 0 : 134; } }
      // the mask (in its own half: um from its outer edge)
      const L = lim(v), inM = um > 0.9 && um < L && v > 0.9 && v < mh && !(v > mh - 2.4 && um < 3.2 - (mh - v)) ;
      if (inM) {
        const dE = Math.min(L - um, um - 0.9, v - 0.9, mh - v), n = vn(x, y, 14, 9467), l = 0.62 - (v / mh) * 0.5 + (um / 13) * 0.2 + (n - 0.5) * 0.3;
        c = l > 0.5 ? 64 : l > 0.3 ? (bay(x, y) < (l - 0.3) * 5 ? 64 : 65) : l > 0.12 ? (bay(x, y) < (l - 0.12) * 5.5 ? 65 : 66) : 66;
        if (dE < 0.16) c = 64; else if (dE < 0.5) c = L - um < 0.5 ? 67 : 66;                                              // the thickness of the porcelain at its broken edge
        // cracks: the long one down to the eye, hairlines off it
        const c1 = Math.abs(um - (7.2 - v * 0.36 + Math.sin(v * 2.3) * 0.5)), on1 = v < 4.2 || (v > 9.4 && v < 11.6);
        if (on1 && c1 < 0.11) c = 69; else if (on1 && c1 < 0.24 && um > 7.2 - v * 0.36) c = 64;
        const c2 = Math.abs(v - (3.1 + (um - 6) * 0.42 + Math.sin(um * 3) * 0.2)); if (um > 7.2 && um < 10.8 && c2 < 0.09) c = 68;
        const c3 = Math.abs(v - (10.3 - (um - 2) * 0.3)); if (um > 1.6 && um < 6 && c3 < 0.08) c = 68;
        if (n > 0.8 && bay(x, y) < 0.3) c = 66;
      } else if (um > 0.9 && um < L + 0.5 && v > 0.9 && v < mh + 0.4 && um >= L) c = 0;                                     // its shadow on the void
      BUF[i] = c;
    }
    // the eyes: the Unmaker's in the mask, the Sunderer's burning in the dark
    const open = 0.55 + 0.45 * eoc(clip01(19.2, 19.5, t)) - 0.25 * clip01(19.7, 20, t);
    const mx = x0 + (26 - 6.3) * s, my = y0 + 6.6 * s, R = 2.3 * s;
    for (let y = fl(my - R); y <= my + R; y++) for (let x = fl(mx - R * 1.25); x <= mx + R * 1.25; x++) { const dx = (x - mx) / (R * 1.25), dy = (y - my) / (R * 0.92 * open), d = dx * dx + dy * dy; if (d < 1 && x >= 0 && x < W && y >= LB && y < H - LB) BUF[y * W + x] = d > 0.8 ? 68 : d > 0.66 ? 69 : 0; }
    { const keep = BUF.slice(); spiralEye(mx, my, R * 0.86, t, 1); for (let y = fl(my - R); y <= my + R; y++) for (let x = fl(mx - R * 1.25); x <= mx + R * 1.25; x++) { if (x < 0 || x >= W || y < 0 || y >= H) continue; const dx = (x - mx) / (R * 1.25), dy = (y - my) / (R * 0.92 * open); if (dx * dx + dy * dy > 0.62) BUF[y * W + x] = keep[y * W + x]; } }
    light(mx, my, R * 3.4, L_MAG, 0.55);
    const kx = x0 + 6.3 * s, ky = y0 + 6.6 * s;
    for (let y = fl(ky - R * 2.4); y <= ky + R * 1.2; y++) for (let x = fl(kx - R * 1.5); x <= kx + R * 1.5; x++) {
      if (x < 0 || x >= W || y < LB || y >= H - LB) continue;
      const dx = (x - kx) / (R * 1.1), dy = (y - ky) / (R * 0.8 * open), d = dx * dx + dy * dy, fl2 = dy < 0 ? vn(x * 0.2, y * 0.12 + t * 7, 1, 9468) * 1.5 * (1 - Math.abs(dx)) : 0;
      if (d < 1) { const sl = Math.abs(dx) < 0.1 + 0.06 * Math.sin(t * 2) && Math.abs(dy) < 0.8; BUF[y * W + x] = sl ? 96 : d < 0.22 ? 22 : d < 0.42 ? 107 : d < 0.66 ? 105 : d < 0.86 ? 104 : 102; }
      else if (d < 1 + fl2 * 2.2 && dy < 0.2) { const e = (d - 1) / (fl2 * 2.2 + 0.001); if (bay(x, y) < 1.1 - e) BUF[y * W + x] = e < 0.3 ? 105 : e < 0.6 ? 103 : 102; }
      else if (d < 1.25 && dy > 0) BUF[y * W + x] = 101;
    }
    light(kx, ky, R * 3.6, L_CRIM, 0.6);
    // ash crossing the lens
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 9469) + t * (0.12 + ih(k, 2, 9469) * 0.2)), x = W + 20 - u * (W + 60), y = LB + ih(k, 3, 9469) * (H - 2 * LB) + Math.sin(u * 9 + k) * 8, big = k % 5 === 0; rectF(x, y, big ? 3 : 1, big ? 2 : 1, k % 4 === 0 ? 121 : k % 4 === 1 ? 0 : 120); }
  }
  shot(19.2, 20.0, (lt, t) => { const u = clip01(19.2, 20.0, t); hollowFace(t, 18.5 + 2.2 * eoc(u), 240 + 6 * u, 164 - 3 * u); GD.vig = 0.5; });
  CAPS.push([19.2, 20.5, 's', 'HOLLOW', 'I AM EVERYTHING YOU SPENT.']);

  /* ---------------------------------------------------------------- 20.0–23.0: the low point */
  const litAt = (t) => { let l = 0; for (const s of SPK) if (t > s) l += 0.22 + 0.2 * Math.exp(-(t - s) * 4); return Math.min(1, l); };
  shot(20.0, 21.5, (lt, t) => {
    const u = clip01(20.0, 21.5, t), V = { x: lerp(262, 270, u), y: lerp(166, 172, u), z: lerp(1.22, 1.42, eio(u)) };
    pinScene(t, V, { lit: litAt(t), eyes: t > 21.15 ? 'narrow' : 'closed', shake: t > 21.15 ? 0.5 : 0 });
    const d = 0.3 - 0.16 * litAt(t); GD.mul = [1 - d, 1 - d, 1 - d * 0.6]; GD.sat = 0.86 + 0.2 * litAt(t); GD.vig = 0.5;
    if (t < 20.3) GD.fade = 1 - t + 20.0 > 0.7 ? 0 : 0;
  });
  // the hand, close: the hero's own pixels, seen from an inch away. The arm reaches across from its body; the end of it
  // opens and closes round the black blade; the broken hilt is still in the other hand, at the bottom of the frame
  shot(21.5, 22.3, (lt, t) => {
    w5Night(t, 80, 40, { noShards: true });
    const C = 9, cg = clip01(21.94, 22.3, t), curl = t < 21.86 ? 0.35 * eoc(clip01(21.5, 21.8, t)) : 0.35 + 0.65 * eob(clip01(21.86, 21.99, t));
    const sh = t > 21.86 ? 2.2 * Math.max(0.3, 1 - (t - 21.95) * 2) : 0.6, jx = Math.round(z5Sh(t, 1) * sh), jy = Math.round(z5Sh(t, 2) * sh), push = 4 * eoc(clip01(21.5, 22.3, t));
    const ox = -fl(push * 2) + jx + Math.round(z5Sh(t * 1.7, 4) * 0.8), oy = jy + Math.round(z5Sh(t * 1.9, 5) * 0.8);
    // the slab's glow from below
    for (let y = H - LB - 30; y < H - LB; y++) for (let x = 0; x < W; x++) if (bay(x, y) < (y - (H - LB - 30)) / 40) P(x, y, 133);
    light(240, H - LB, 220, L_WARM, 0.25);
    const BX = 286 + ox, bladeX = BX + 2.2 * C;
    // a pixel of the hero's skin, shaded: lit from the blade on its right (rim), turned away on its left, its texture kept
    const skin5 = (i, j, edgeT, edgeB, k) => { const d = (BX + i * C) - bladeX, rim = d > -3 * C ? 2 : d > -6 * C ? 1 : 0, n = ((i * 7 + j * 3) % 9 === 0); if (j === edgeT) return rim ? 37 : 35; if (j === edgeB) return 36; if (rim === 2) return n ? 35 : 37; return n ? 36 : k; };
    const cell = (i, j, c) => { const x = BX + i * C, y = 60 + j * C + oy; rectF(x, y, C, C, c); if (c === 35 || c === 37) { rectF(x, y + C - 2, C, 2, 36); if (c === 37) rectF(x, y, C, 1, 22); } else if (c === 36) rectF(x, y + C - 1, C, 1, 38); };
    // the body: its corner, from the left edge of the frame (its eye at the top), cracked through
    const shade = (i, j, top, bot) => (j === top ? 37 : j >= bot - 1 ? 36 : (i + j) % 5 === 0 ? 36 : 35);
    for (let j = -4; j < 18; j++) for (let i = -40; i < -18; i++) cell(i, j, i === -19 ? 37 : i < -36 ? 36 : shade(i, j, -4, 18));
    for (let j = -4; j < 18; j++) rectF(BX - 18 * C, 60 + j * C + oy, 3, C, 22);                    // its outline
    { const e = t > 21.62 && t < 21.7 ? 1 : 3; cell(-25, 0, 0); cell(-24, 0, 0); if (e > 1) { cell(-25, 1, 0); cell(-24, 1, 0); cell(-25, 2, 0); cell(-24, 2, 0); cell(-24, 0, 22); } cell(-23, -1, 0); cell(-24, -2, 0); }   // the eye, angry
    // the arm, reaching right to the blade (at x of cell 0); the hand: a block that splits into two prongs that close
    const AJ = 8;
    for (let j = AJ; j < AJ + 4; j++) for (let i = -18; i < -1; i++) cell(i, j, skin5(i, j, AJ, AJ + 3, j === AJ + 2 ? 36 : 35));
    for (let i = -18; i < -1; i++) { rectF(BX + i * C, 60 + AJ * C - 3 + oy, C, 3, 22); rectF(BX + i * C, 60 + (AJ + 4) * C + oy, C, 3, 22); }
    // the black blade, behind the fingers
    const ba = PI / 2 + 0.16, bx0 = BX + 2 * C + 30 * Math.cos(ba) * -8, by0 = LB - 30;
    bigBlade(BX + 2.2 * C - Math.cos(ba) * 200 + ox * 0.3, 60 + (AJ + 2) * C - Math.sin(ba) * 200, ba, 520, 15, t, { form: 'void', flare: 0.5, noHilt: true, cracks: cg * 2.4 });
    // the palm, behind: the end of the arm
    for (let j = AJ - 1; j < AJ + 5; j++) for (let i = -2; i < 1; i++) cell(i, j, skin5(i, j, AJ - 1, AJ + 4, 35));
    // white cracks running up and down the blade from the grip
    if (cg > 0) for (let k = 0; k < 10; k++) { const sd = k & 1 ? 1 : -1; let x = BX + 2.2 * C + (ih(k, 1, 9471) - 0.5) * 18, y = 60 + (AJ + 2) * C; for (let q = 0; q < 10 * cg; q++) { const nx = x + (ih(k, q, 9473) - 0.5) * 12 + sd * 2, ny = y + sd * (9 + ih(k, q, 9472) * 12); lineP(x, y, nx, ny, 22); if (q % 2 === 0) lineP(x + 1, y, nx + 1, ny, 140); x = nx; y = ny; } }
    // the fingers: two prongs from the palm, opening up and down, then closing across the front of the blade
    const open = 1 - curl, reach = fl(1 + 4 * curl);
    for (const [j0, sd] of [[AJ - 1, -1], [AJ + 3, 1]]) {
      const lift = Math.round(open * 3) * sd;
      for (let q = 0; q < reach; q++) for (let jj = 0; jj < 2; jj++) { const j = j0 + jj + lift + (q > 2 ? -sd * Math.round(curl) : 0); cell(1 + q, j, jj === (sd < 0 ? 0 : 1) ? (sd < 0 ? 37 : 36) : 37); }
      rectF(BX + (1 + reach) * C, 60 + (j0 + lift + (reach > 3 ? -sd * Math.round(curl) : 0)) * C + oy, 3, 2 * C, 22);
    }
    // light leaking from the cracks in the hand and arm; brighter as it grips
    const crk = [[-14, AJ + 1, 5], [-9, AJ, 4], [-5, AJ + 2, 4], [-1, AJ, 5], [-22, 3, 6], [-28, 10, 7], [-33, 5, 5]];
    crk.push([-12, AJ + 3, 4], [-7, AJ + 1, 3], [-30, -2, 6], [-26, 14, 6], [-37, 8, 4]);
    const flick = 0.75 + 0.25 * Math.sin(t * 37) * Math.sin(t * 13);
    for (const [i, j, L] of crk) { let x = BX + i * C + 4, y = 60 + j * C + oy; for (let q = 0; q < L; q++) { const nx = x + 7 + (ih(i, q, 9474) - 0.5) * 8, ny = y + (ih(j, q, 9475) - 0.5) * 12; thick(x - 1, y - 1, nx - 1, ny - 1, 4, 102); thick(x, y, nx, ny, 2, q % 3 === 0 && cg > 0.2 ? 22 : 107); x = nx; y = ny; } light(BX + i * C, 60 + j * C, 34, L_WARM, (0.3 + 0.45 * cg) * flick); }
    light(bladeX, 60 + (AJ + 2) * C, 120, L_MAG, 0.35); light(bladeX - 30, 60 + (AJ + 2) * C, 60, L_WH, 0.25 + 0.3 * cg);
    // sparks of void spat from the grip; the shake
    for (let k = 0; k < 18 * (0.3 + cg); k++) { const u = frac(ih(k, 1, 9476) + t * 2.4), a = (ih(k, 2, 9476) - 0.5) * 2.4 + (k & 1 ? 0 : PI), v = 40 + ih(k, 3, 9476) * 90, x = BX + 2 * C + Math.cos(a) * v * u, y = 60 + (AJ + 2) * C + Math.sin(a) * v * u + 40 * u * u; if (bay(fl(x), fl(y)) < 1 - u) lineP(x, y, x - Math.cos(a) * 4, y - Math.sin(a) * 4, k % 3 ? 74 : 22); }
    // the fourth spark
    { const g = t - 21.9, sx = BX + 2 * C, sy = 60 + (AJ + 1) * C; if (g < 0) { const u = 1 + g / 0.4, e = eio(clamp(u, 0, 1)), x = sx + 170 * (1 - e), y = sy - 90 * (1 - e) + Math.sin(u * 6) * 8 * (1 - u); light(x, y, 40, L_VIO, 0.7); discF(x, y, 7, 63); discF(x, y, 5.6, ORB[3][1]); discF(x - 1.6, y - 1.6, 2.8, ORB[3][2]); P(x - 2, y - 2, 22); for (let q = 1; q < 9; q++) { const e2 = eio(clamp(u - q * 0.03, 0, 1)); if (bay(q, fl(t * 30)) < 1 - q / 9) rectF(sx + 170 * (1 - e2), sy - 90 * (1 - e2), 2, 2, ORB[3][q < 4 ? 2 : 1]); } } else { shockRing(sx, sy, 6 + g * 260, 6 + g * 200, 3, [22, ORB[3][2], ORB[3][1]], 1 - g / 0.4); light(sx, sy, 150 * Math.max(0.3, 1 - g * 1.5), L_VIO, 0.8 * Math.max(0.25, 1 - g * 2)); light(sx, sy + 10, 90, L_GOLD, 0.6 * cg); if (g < 0.1) GD.ca = 2 * (1 - g / 0.1); } }
    for (let k = 0; k < 26; k++) { const u = frac(ih(k, 1, 9477) + t * 0.25), x = W + 10 - u * (W + 30), y = LB + ih(k, 2, 9477) * (H - 2 * LB), big = k % 4 === 0; rectF(x, y, big ? 3 : 1, big ? 2 : 1, k % 2 ? 121 : 120); }
    GD.vig = 0.55; shk(sh * 0.5);
  });
  CAPS.push([21.6, 22.9, 's', 'HERO', "THEN I'LL SPEND MORE."]);
  shot(22.3, 23.0, (lt, t) => {
    const u = clip01(22.3, 23.0, t), V = { x: 250, y: lerp(150, 140, u), z: lerp(1.05, 1.0, u) };
    pinScene(t, V, { lit: 1, eyes: 'angry', grip: 1, up: eio(u), drain: eic(u) * 0.9 + 0.1, hz: eio(u), shake: 0.6 + 1.6 * u, eEyes: u > 0.45 ? 'wide' : 'narrow' });
    GD.vig = 0.42; shk(1.6 * u * u);
  });
  WORLDS.pin = () => pinScene(22.99, { x: 250, y: 140, z: 1 }, { lit: 1, eyes: 'angry', grip: 1, up: 1, drain: 1, hz: 1 });
  }

  /* ================================================================ ACT IV — dawnbreak (23.0–29.4)
     23.0 DAWNBREAK: it drinks the darkness of the blade that pins it; the blade drains, cracks and crumbles into it. Half
     dawn fire, half star-flecked night; a ring of sunrise behind its head with the four sparks orbiting it; a wing of light
     and a wing of night; a blade half white, half black. The world is redrawn outward from it as a cosmos of glowing line:
     a burning horizon under a striped sun and its rings, ranges of mountains and ruined towers in contour and hatching,
     floating islands, nebulae drawn as contour lines, constellations, embers. 25.0 / 25.4 / 25.7 / 26.0 / 26.2 / 26.4 six
     strikes, six camera set-ups, cut on each impact: a rising cut chips the mask; a chop takes the blade arm; a vault takes
     a wing; a thrust puts out the crimson eye; a spinning kick bursts its body; a dash through it strips its fire. 27.0 an
     uppercut; 27.6 / 28.2 / 28.8 it is driven up through three panes of sky (the stair city, the ink void, the hanging
     ocean); at the top it re-knits its arm out of the dark and both blades race out to the length of the world.
     The world painter and a few helpers are shared with s6 through WORLDS.d5line (the one registry both files see). */
  {
  /* ---------------------------------------------------------------- the Dawnbreak world */
  const D5 = { hy: 200, sx: 330 };
  const D5WR = new Float32Array(W);
  const d5wrap = (v, w) => ((v % w) + w) % w;
  // a layer's screen point: p 0 (infinitely far) .. 1 (the fighters' plane)
  const d5Lx = (V, wx, p) => 240 + (wx - 240 - (V.x - 240) * p) * (1 + (V.z - 1) * p);
  const d5Ly = (V, wy, p) => 135 + (wy - 135 - (V.y - 135) * p) * (1 + (V.z - 1) * p);
  // constellations: a figure of 5–7 stars, each joined to the one before (and one branch)
  const CONS = []; for (let k = 0; k < 9; k++) { const n = 5 + (k % 3), pts = []; let x = 0, y = 0; for (let q = 0; q < n; q++) { pts.push([x, y]); x += 14 + ih(k, q, 9701) * 26; y += (ih(k, q, 9702) - 0.5) * 34; } CONS.push({ x: ih(k, 1, 9703) * 700, y: ih(k, 2, 9703) * 520, pts, br: 1 + fl(ih(k, 3, 9703) * (n - 2)) }); }
  // floating islands, through the whole height the chase climbs
  const ISL = []; for (let k = 0; k < 16; k++) ISL.push({ wx: ih(k, 1, 9711) * 760, wy: 168 - k * 92 - ih(k, 2, 9711) * 40, w: 26 + ih(k, 3, 9711) * 46, d: 0.7 + ih(k, 4, 9711) * 0.7, p: 0.38 + ih(k, 5, 9711) * 0.3, ruin: ih(k, 6, 9711) < 0.5 });
  const TWR = []; for (let k = 0; k < 9; k++) TWR.push({ wx: 30 + k * 84 + ih(k, 1, 9712) * 40, h: 20 + ih(k, 2, 9712) * 44, w: 5 + fl(ih(k, 3, 9712) * 7), lean: (ih(k, 4, 9712) - 0.5) * 0.25, brk: ih(k, 5, 9712) });
  const NEB = new Float32Array(121 * 62);
  const d5Col = (x, y, cool, warm) => (bay(x + 3, y + 5) < D5WR[clamp(fl(x), 0, W - 1)] ? warm : cool);
  // the burning horizon: a white-hot line, flames licking up, embers; curve(x) lifts it (the hand that takes it)
  function d5Horizon(t, hy, burn, xa, xb, curve, ox) {
    xa = Math.max(0, fl(xa)); xb = Math.min(W, xb);
    for (let x = xa; x < xb; x++) {
      const wx = x + ox * 0.6, y = Math.round(hy - (curve ? curve(x) : 0)), hgt = (1.5 + 8 * Math.pow(vn(wx * 0.35, t * 4.5, 1, 8630), 2) + 3.5 * vn(wx * 0.08, t * 1.5, 1, 8631)) * burn;
      for (let q = 0; q < hgt; q++) { const u = q / hgt; if (bay(x, y - 2 - q) < 1.1 - u) P(x, y - 2 - q, u < 0.25 ? 140 : u < 0.5 ? 141 : u < 0.78 ? 110 : 105); }
      P(x, y + 2, bay(x, y + 2) < 0.5 ? 141 : 110); P(x, y - 1, 22); P(x, y, 22); P(x, y + 1, 140); if (burn > 0.8 && bay(x, y + 3) < 0.4) P(x, y + 3, 110);
    }
    for (let k = 0; k < 70; k++) { const u = frac(ih(k, 1, 8632) + t * (0.3 + ih(k, 2, 8632) * 0.5)), x = xa + ih(k, 3, 8632) * (xb - xa) + Math.sin(u * 7 + k) * 4, y = hy - (curve ? curve(x) : 0) - 3 - u * (20 + ih(k, 4, 8632) * 56); if (x >= xa && x < xb && bay(fl(x), fl(y)) < (1 - u) * burn) P(x, y, u < 0.3 ? 140 : u < 0.6 ? 141 : 105); }
    for (let x = Math.max(30, xa); x < xb; x += 70) light(x, hy - (curve ? curve(x) : 0), 46, L_GOLD, 0.36 * burn);
  }
  // a range: ridge from fbm, filled black, its ridge and nested contours glowing (warm toward the sun, violet and teal away),
  // hatching on the slopes that face away from the light; ruins stand on the far one
  function d5Range(t, V, hy, p, base, amp, scale, seed, cool, warm, hatch, towers, tone) {
    const zf = 1 + (V.z - 1) * p, top = LB; let py = null, pyk = [null, null, null];
    const hs = new Float32Array(W);
    for (let x = 0; x < W; x++) { const wx = (x - 240) / zf + 240 + (V.x - 240) * p, f = fbm(wx, seed, scale, 4, seed); hs[x] = (base + amp * Math.max(0, f - 0.32) * 2.6) * zf; }
    for (let x = 0; x < W; x++) {
      const hgt = hs[x], y = Math.round(hy - hgt); if (y >= hy) { py = null; continue; }
      for (let yy = Math.max(top, y); yy < hy; yy++) BUF[yy * W + x] = bay(x, yy) < tone * (1 - (hy - yy) / (hgt + 8) * 0.5) ? d5Col(x, yy, 139, 9) : 0;
      const sl = x ? hs[x] - hs[x - 1] : 0, lit = (x < D5.sx ? -sl : sl) > 0.02;
      const c0 = d5Col(x, y, lit ? cool[0] : cool[1], lit ? warm[0] : warm[1]);
      if (py !== null) for (let yy = Math.min(y, py); yy <= Math.max(y, py); yy++) if (yy >= top) P(x, yy, c0); py = y;
      if (y + 1 < hy) P(x, y + 1, d5Col(x, y, cool[1], warm[1]));
      // nested contours: the same ridge, lower, dimmer, dashed
      for (let k = 0; k < 3; k++) { const yk = Math.round(hy - hgt * (0.74 - k * 0.22)); if (yk >= hy - 1 || yk < top) continue; const on = (fl((x + (V.x * p) * zf) / (3 + k * 2)) % (k + 2)) !== 0; if (on) P(x, yk, d5Col(x, yk, cool[2 + Math.min(k, 1)], warm[2 + Math.min(k, 1)])); }
      // hatching on the side away from the light
      if (!lit && fl(x + V.x * p * zf) % 3 === 0) { const L = Math.min(hgt * 0.55, 3 + hgt * 0.4); for (let q = 2; q < L; q++) if (bay(x, y + q) < 0.9 - q / L * 0.7) P(x - q * 0.35, y + q, hatch); }
    }
    if (towers) for (const T of TWR) {
      const x0 = Math.round(240 + (T.wx - 240 - (V.x - 240) * p) * zf); if (x0 < -20 || x0 > W + 20) continue;
      const by = Math.round(hy - (hs[clamp(x0, 0, W - 1)] || 0)) + 2, h = T.h * zf, w = Math.max(3, Math.round(T.w * zf)), c = d5Col(x0, by, cool[0], warm[0]), c2 = d5Col(x0, by, cool[2], warm[2]);
      for (let q = 0; q < h; q++) { const y = by - q, lx = x0 + Math.round(T.lean * q); if (y < top) break; const brk = q > h * (0.7 + 0.3 * T.brk) - (lx & 1) * 3; if (brk) break; rectF(lx + 1, y, w - 1, 1, 0); P(lx, y, c); P(lx + w, y, c); if (q % 7 === 3 && w > 4) for (let i = 2; i < w - 1; i += 2) P(lx + i, y, ih(T.wx + i, q, 9713) < 0.3 ? 141 : c2); }
      const tq = h * (0.7 + 0.3 * T.brk); for (let i = 0; i <= w; i++) P(x0 + Math.round(T.lean * tq) + i, by - tq + Math.round(Math.abs(Math.sin(i * 1.7 + T.wx)) * 3), c);
      if (T.brk > 0.6) lineP(x0 + w / 2 + T.lean * tq, by - tq, x0 + w / 2 + T.lean * tq + 2, by - tq - 9 * zf, c);
    }
  }
  /* o: { hz (world y of the horizon), sunX, burn, noLine, noSun, curve (fn x → lift), dim } */
  function d5World(t, V, o) {
    o = o || {};
    const top = LB, bot = H - LB, z = V.z;
    const hy = Math.round(d5Ly(V, o.hz === undefined ? 200 : o.hz, 0.5)), sx = d5Lx(V, o.sunX === undefined ? 330 : o.sunX, 0.15), burn = o.burn === undefined ? 1 : o.burn;
    D5.hy = hy; D5.sx = sx;
    for (let x = 0; x < W; x++) { const d = (x - sx) / 200; D5WR[x] = Math.exp(-d * d) * 0.96; }
    // the sky: black at the zenith, deep indigo to the horizon, burning plum and wine toward the sun
    const NR = [0, 0, 0, 138, 138, 139, 139, 3], WRr = [0, 0, 0, 138, 9, 9, 10, 10];
    for (let y = top; y < bot; y++) {
      const row = y * W, d = hy - y;
      if (d < 0) { const k = -d; for (let x = 0; x < W; x++) BUF[row + x] = k < 18 && bay(x, y) < (1 - k / 18) * 0.55 ? (bay(x + 1, y + 2) < D5WR[x] ? 9 : 138) : 0; continue; }
      const f = clamp(1 - d / 260, 0, 0.999) * (NR.length - 1), k = fl(f), r = f - k, wk = clamp(1.5 - d / 150, 0, 1);
      for (let x = 0; x < W; x++) { const R = bay(x + 2, y + 1) < D5WR[x] * wk ? WRr : NR; BUF[row + x] = bay(x, y) < r ? R[k + 1] : R[k]; }
    }
    // nebulae, drawn as contour lines of a slow field
    {
      const p = 0.07, ox = (V.x - 240) * p, oy = (V.y - 135) * p;
      for (let j = 0; j < 62; j++) for (let i = 0; i < 121; i++) NEB[j * 121 + i] = fbm(i * 4 + ox, j * 4 + oy + t * 1.5, 90, 3, 9714);
      for (let y = top; y < Math.min(bot, hy - 6); y++) {
        const gy = (y - top) / 4, j = Math.min(60, fl(gy)), fy = gy - j;
        for (let x = 0; x < W; x++) {
          const gx = x / 4, i = Math.min(119, fl(gx)), fx = gx - i, q = j * 121 + i;
          const n = (NEB[q] * (1 - fx) + NEB[q + 1] * fx) * (1 - fy) + (NEB[q + 121] * (1 - fx) + NEB[q + 122] * fx) * fy;
          if (n < 0.5) continue;
          const lv = (n - 0.5) * 16, fr = frac(lv);
          if (fr < 0.08 && ((x + y) & 1)) BUF[y * W + x] = n > 0.68 ? d5Col(x, y, 127, 131) : n > 0.6 ? d5Col(x, y, 6, 133) : d5Col(x, y, 5, 10);
          else if (n > 0.6 && bay(x, y) < (n - 0.6) * 1.4) BUF[y * W + x] = d5Col(x, y, 139, 9);
        }
      }
    }
    // an aurora drawn in vertical strokes: a curtain of first light over the night side, gold where it nears the sun
    if (hy > top + 40) {
      const p = 0.1, zf = 1 + (z - 1) * p;
      for (let x = 0; x < W; x += 2) {
        const wx = (x - 240) / zf + 240 + (V.x - 240) * p, yc = hy - (118 + Math.sin(wx * 0.011 + t * 0.25) * 26 + Math.sin(wx * 0.033 - t * 0.4) * 9) * zf, n = vn(wx * 0.9, t * 0.6, 22, 9741), L = (14 + 46 * n * n) * zf, br = vn(wx * 0.5, -t * 0.8, 9, 9742);
        if (br < 0.3) continue;
        for (let q = 0; q < L; q++) { const y = yc + q, u = q / L; if (y < top || y > hy - 30) continue; if (bay(x, fl(y)) > (1 - u) * (br - 0.2) * 1.5) continue; P(x, y, u < 0.15 ? d5Col(x, y, 129, 141) : u < 0.45 ? d5Col(x, y, 128, 110) : u < 0.75 ? d5Col(x, y, 6, 12) : d5Col(x, y, 5, 10)); }
      }
      light(d5Lx(V, 120, 0.1), hy - 110, 160, L_COLD, 0.12);
    }
    // stars
    for (let k = 0; k < 230; k++) {
      const p = 0.03 + (k % 4) * 0.03, x = d5wrap(ih(k, 1, 9720) * 640 - (V.x - 240) * p, 640) - 80, y = d5wrap(ih(k, 2, 9720) * 560 - (V.y - 135) * p, 560) - 140;
      if (y < top || y > hy - 4 || x < 0 || x >= W) continue;
      const tw = frac(ih(k, 3, 9720) + t * (0.3 + ih(k, 4, 9720) * 0.5));
      if (k % 13 === 0) { const L = 2 + 2 * Math.sin(tw * TAU); sparkle(x, y, L, 22, d5Col(x, y, 57, 141)); light(x, y, 10, L_COLD, 0.25); }
      else if (k % 3 === 0) P(x, y, tw < 0.8 ? d5Col(x, y, 57, 141) : 6);
      else if (tw < 0.85) P(x, y, d5Col(x, y, k & 1 ? 5 : 128, 133));
    }
    // constellations
    for (let k = 0; k < CONS.length; k++) {
      const C = CONS[k], p = 0.06, bx = d5wrap(C.x - (V.x - 240) * p, 700) - 110, by = d5wrap(C.y - (V.y - 135) * p, 520) - 100 + top;
      const pts = C.pts.map(([px, py]) => [bx + px, by + py]);
      const seg = (a, b) => lineF(a[0], a[1], b[0], b[1], (x, y, u) => { if (y < top || y > hy - 18 || u < 0.12 || u > 0.88) return; if (((x + y) & 1) === 0) P(x, y, d5Col(x, y, k % 2 ? 126 : 6, 132)); });
      for (let q = 1; q < pts.length; q++) seg(pts[q - 1], pts[q]);
      if (pts.length > 3) seg(pts[C.br], [pts[C.br][0] + 10, pts[C.br][1] + 26]);
      for (let q = 0; q < pts.length; q++) { const [x, y] = pts[q]; if (y < top || y > hy - 18) continue; const tw = frac(ih(k, q, 9721) + t * 0.5); P(x, y, 22); if (q === 0 || tw < 0.3) sparkle(x, y, 1.5 + tw * 2, 22, d5Col(x, y, 57, 141)); else { P(x + 1, y, d5Col(x, y, 57, 141)); P(x - 1, y, d5Col(x, y, 57, 141)); } }
    }
    // the sun: striped half-disc on the line, its rings (an astrolabe), long thin rays
    if (!o.noSun && hy > top - 40) {
      const zr = 1 + (z - 1) * 0.2, SR = 40 * zr;
      const RG = [[56, 141, 0, 0], [70, 110, 3, 0.5], [92, 13, 0, 0], [124, 12, 5, -0.3], [168, 133, 7, 0.15], [226, 132, 0, 0], [300, 10, 4, -0.1]];
      for (let r = 0; r < RG.length; r++) {
        const [R0, c, dash, spin] = RG[r], R = R0 * zr;
        for (let a = PI; a < TAU; a += 0.55 / R) { const x = sx + Math.cos(a) * R, y = hy + Math.sin(a) * R; if (y >= hy - 2 || y < top || x < 0 || x >= W) continue; if (dash && fl(a * R / 3 + t * spin * 12) % dash === 0) continue; P(x, y, c); }
        if (r === 2 || r === 4) for (let d = 0; d < 36; d++) { const a = PI + d / 36 * PI + t * 0.02 * (r === 2 ? 1 : -1), L = (d % 3 === 0 ? 7 : 3) * zr; lineP(sx + Math.cos(a) * R, hy + Math.sin(a) * R, sx + Math.cos(a) * (R - L), hy + Math.sin(a) * (R - L), r === 2 ? 110 : 12); }
      }
      for (let k = 0; k < 40; k++) {
        const a = PI + (k + 0.5) / 40 * PI + Math.sin(t * 0.3) * 0.01, r0 = (60 + (k % 2) * 8) * zr, r1 = r0 + (40 + ih(k, 1, 9722) * 230 + Math.sin(t * 1.3 + k) * 10) * zr, ca = Math.cos(a), sa = Math.sin(a);
        lineF(sx + ca * r0, hy + sa * r0, sx + ca * r1, hy + sa * r1, (x, y, u) => { if (y > top && y < hy - 2 && bay(x, y) < 1 - u * 0.8) P(x, y, u < 0.25 ? 141 : u < 0.55 ? 110 : u < 0.8 ? 12 : 10); });
      }
      for (let y = Math.max(top, fl(hy - SR)); y < hy; y++) {
        const dy = hy - y, v = dy / SR, half = Math.sqrt(Math.max(0, SR * SR - dy * dy)), gap = v < 0.6 && frac(dy / (2.2 + v * 9)) < (0.6 - v) * 0.75;
        if (gap) continue;
        const c = v > 0.78 ? 16 : v > 0.55 ? 15 : v > 0.33 ? 141 : v > 0.16 ? 110 : 14;
        for (let x = Math.max(0, fl(sx - half)); x < Math.min(W, sx + half); x++) BUF[y * W + x] = c;
      }
      light(sx, hy - SR * 0.5, 170 * zr, L_WARM, 0.4 * burn); light(sx, hy, 280, L_GOLD, 0.14 * burn);
    }
    // far ranges with ruins; the near range
    if (hy > top - 4 && hy < bot + 120) {
      d5Range(t, V, hy, 0.12, 6, 74, 150, 9730, [57, 6, 5, 139], [141, 110, 13, 10], 139, true, 0.3);
      d5Range(t, V, hy, 0.3, 2, 40, 110, 9731, [129, 128, 126, 125], [22, 140, 110, 12], 138, false, 0.12);
      // heat haze: the rows over the line shiver, and broken bands of heat hang in them
      for (let y = Math.max(top, hy - 18); y < hy - 1; y++) { const sh = Math.round(Math.sin(y * 1.7 + t * 9) * 1.4 * (1 - (hy - y) / 18) + Math.sin(y * 0.6 - t * 5) * 0.6), row = y * W; if (!sh) continue; if (sh > 0) for (let x = W - 1; x >= sh; x--) BUF[row + x] = BUF[row + x - sh]; else for (let x = 0; x < W + sh; x++) BUF[row + x] = BUF[row + x - sh]; }
      for (let k = 0; k < 5; k++) { const y = hy - 4 - k * (2 + k), c = [110, 14, 13, 12, 10][k]; for (let x = 0; x < W; x++) { const n = vn(x * 0.06 + k * 5, t * (1.5 + k * 0.4), 1, 9732 + k); if (n > 0.55 - D5WR[x] * 0.15 && bay(x, y) < (n - 0.5) * 3) P(x, y + Math.sin(x * 0.04 + t * 3 + k) * 0.8, c); } }
    }
    // below the line: the cloud sea drawn as contour waves, the sun's road on it, perspective lines to the sun
    if (hy < bot) {
      for (let k = 0; k < 14; k++) { const a = PI * 0.04 + k / 13 * PI * 0.92; lineF(sx, hy + 2, sx + Math.cos(a) * 700, hy + 2 + Math.sin(a) * 700, (x, y, u) => { if (y > hy + 4 && y < bot && (x + y) % 3 === 0 && bay(x, y) < 0.7 - u * 0.4) P(x, y, d5Col(x, y, 139, 9)); }); }
      for (let k = 1; k <= 10; k++) {
        const y0 = hy + 3 + k * k * 1.5; if (y0 >= bot) break; if (y0 < top) continue;
        const cw = k < 2 ? 141 : k < 4 ? 110 : k < 6 ? 13 : k < 8 ? 12 : 10, cc = k < 3 ? 57 : k < 5 ? 128 : k < 7 ? 6 : 5;
        for (let x = 0; x < W; x++) { const wx = x + (V.x - 240) * (0.3 + k * 0.12), n = vn(wx, k * 7, 26 + k * 6, 8620); if (n < 0.32 + k * 0.02) continue; const y = y0 + Math.sin(wx * 0.05 / (0.4 + k * 0.1) + t * (1.4 - k * 0.1) + k) * (0.6 + k * 0.5); P(x, y, d5Col(x, y, cc, cw)); }
      }
      for (let k = 0; k < 34; k++) { const x = sx + (ih(k, 1, 8621) - 0.5) * 80, y = hy + 4 + ih(k, 2, 8621) * 90, L = 2 + ih(k, 3, 8621) * 10 * ((y - hy) / 90 + 0.3); if (y < bot && frac(ih(k, 4, 8621) + t * 0.8) < 0.7) lineP(x - L, y, x + L, y, y < hy + 24 ? 140 : 141); }
    }
    // the horizon
    if (!o.noLine && hy > top - 10 && hy < bot + 10) d5Horizon(t, hy, burn, 0, W, o.curve, V.x);
    // floating islands: black rock, the lit rim of their tops, hatched undersides, roots, a ruin on some
    for (let k = 0; k < ISL.length; k++) {
      const I = ISL[k], zf = 1 + (z - 1) * I.p, cx = d5wrap(I.wx - (V.x - 240) * I.p + t * 3 * (k & 1 ? 1 : -1), 760) - 140, cy = d5Ly(V, I.wy, I.p) + Math.sin(t * 0.8 + k) * 2.5;
      const w = I.w * zf, d = w * I.d; if (cx < -w || cx > W + w || cy < top - d - 20 || cy > bot + 10) continue;
      const lit = cx < sx ? 1 : -1;
      for (let x = Math.max(0, fl(cx - w)); x < Math.min(W, cx + w); x++) {
        const u = (x - cx) / w, ytop = Math.round(cy - 2 - 3 * vn(x - cx, k, 6, 9733) - (1 - u * u) * 3), yb = Math.round(cy + d * Math.pow(1 - Math.abs(u), 1.4) * (0.6 + 0.4 * vn(x - cx, k, 4, 9734)));
        for (let y = Math.max(top, ytop); y <= Math.min(bot - 1, yb); y++) BUF[y * W + x] = 0;
        const rim = u * lit < 0.3 ? d5Col(x, ytop, 135, 22) : d5Col(x, ytop, 128, 141);
        P(x, ytop, rim); if (u * lit < -0.2) P(x, ytop + 1, d5Col(x, ytop, 57, 140));
        P(x, yb, d5Col(x, yb, 5, 12));
        for (let y = ytop + 4; y < yb - 1; y += 3) if (((x + (y >> 1)) & 3) === 0 && bay(x, y) < 0.8) P(x, y, (u * lit) > 0.1 ? 139 : d5Col(x, y, 5, 10));
        if (fl(x - cx) % 9 === 0 && ih(fl(x - cx), k, 9735) < 0.6) { const L = 4 + ih(fl(x - cx), k, 9736) * 12 * zf; for (let q = 0; q < L; q++) if (bay(x, yb + q) < 1 - q / L) P(x + Math.sin(q * 0.4 + t + k) * 0.8, yb + q, d5Col(x, yb, 5, 10)); }
      }
      if (I.ruin && w > 18) for (let q = -1; q <= 1; q++) { const px = cx + q * w * 0.35, ph = (6 + ih(k, q + 2, 9737) * 10) * zf, py = cy - 4; lineP(px, py, px, py - ph, d5Col(px, py, 57, 141)); lineP(px + 2, py, px + 2, py - ph * 0.8, d5Col(px, py, 6, 110)); if (q === 0) lineP(px - w * 0.35, py - ph * 0.9, px + w * 0.35, py - ph * 0.7, d5Col(px, py, 6, 110)); }
    }
    // embers drifting up, and star-dust drifting down on the night side
    for (let k = 0; k < 80; k++) {
      const p = 0.6 + ih(k, 1, 9740) * 0.6, u = frac(ih(k, 2, 9740) + t * (0.12 + ih(k, 3, 9740) * 0.2)), x = d5wrap(ih(k, 4, 9740) * 560 - (V.x - 240) * p + Math.sin(t * 1.3 + k) * 8 + u * 40, 560) - 40, y = d5wrap(bot + 20 - u * 300 - (V.y - 135) * p * 0.6, 320) + top - 10;
      if (x < 0 || x >= W || y < top || y >= bot) continue; const c = d5Col(x, y, k % 3 ? 56 : 128, k % 3 ? 141 : 110);
      if (bay(fl(x), fl(y)) < 1 - u * 0.6) { P(x, y, c); if (k % 7 === 0) { P(x, y + 1, c === 141 ? 110 : 6); } }
    }
    if (o.dim) tintAll(T_DARK, o.dim);
  }
  // the nearest layer, drawn after the fighters: black rocks with burning rims sliding past, and out-of-focus embers
  function d5Fore(t, V, o) {
    o = o || {}; const amt = o.amt === undefined ? 1 : o.amt; if (amt <= 0) return;
    for (let k = 0; k < 3; k++) {
      const p = 1.7 + k * 0.3, zf = 1 + (V.z - 1) * 0.6, cx = d5wrap(ih(k, 1, 9750) * 900 - (V.x - 240) * p - t * 30, 900) - 210, cy = H - LB + 6 - (k === 1 ? 4 : 0) - (V.y - 135) * p * 0.3, r = (26 + ih(k, 2, 9750) * 22) * zf;
      if (cx < -r * 1.6 || cx > W + r * 1.6) continue;
      const pts = []; for (let q = 0; q < 9; q++) { const a = PI + q / 8 * PI, rr = r * (0.75 + 0.35 * ih(k, q, 9751)); pts.push([cx + Math.cos(a) * rr * 1.5, cy + Math.sin(a) * rr]); }
      pts.push([cx + r * 1.5, H]); pts.push([cx - r * 1.5, H]);
      polyF(pts, () => 0);
      for (let q = 0; q < 8; q++) { const [ax, ay] = pts[q], [bx, by] = pts[q + 1], lit = cx > D5.sx ? q < 4 : q >= 4; lineP(ax, ay, bx, by, lit ? (cx > D5.sx - 100 ? 141 : 128) : 139); if (lit) lineP(ax, ay + 1, bx, by + 1, cx > D5.sx - 100 ? 110 : 5); }
    }
    for (let k = 0; k < 10; k++) { const u = frac(ih(k, 1, 9752) + t * 0.18), x = d5wrap(ih(k, 2, 9752) * 600 - (V.x - 240) * 2 + Math.sin(t + k) * 20, 600) - 60, y = H - LB - u * (H - 2 * LB) - (V.y - 135) * 1.2 % 200; if (y < LB || y > H - LB - 3) continue; const r = 1.2 + ih(k, 3, 9752) * 1.8; if (bay(k, fl(t * 30)) < 0.85 * amt) { discF(x, y, r, k % 3 ? 110 : 141); if (r > 2) P(x, y, 16); } light(x, y, 10, L_WARM, 0.3 * amt); }
  }

  /* ---------------------------------------------------------------- shared helpers: hit-stop, a blow, the two fighters */
  // the clock holds at each hit for its hold, then runs fast until it has caught up by the next hit (or soon after)
  function d5Stop(t, hits) {
    for (let i = 0; i < hits.length; i++) { const [h, d] = hits[i], end = Math.min(i + 1 < hits.length ? hits[i + 1][0] : 1e9, h + d + Math.max(0.24, d * 3)); if (t >= h && t < end) { if (t < h + d) return h; return h + (end - h) * (t - h - d) / (end - h - d); } }
    return t;
  }
  const d5Held = (t, hits) => { for (const [h, d] of hits) if (t >= h && t < h + d) return true; return false; };
  const d5On = (t, h) => Math.round(t * 30) === Math.round(h * 30);
  // a heavy blow at (x, y) for hit time h held for hold: the effect is held with the clock, the one ink frame on the hit frame
  function d5Heavy(x, y, g, pw, dir, cols, seed, imp, keep, lcol) {
    if (g < 0 || g > 1.2) return;
    if (g < 0.5) {
      shockRing(x, y, 8 + g * 380 * pw, 5 + g * 210 * pw, 2 + pw, [22, cols[1], cols[2]], 1 - g / 0.5);
      if (pw >= 2) shockRing(x, y, 4 + g * 240 * pw, 3 + g * 80 * pw, 2, [cols[1], cols[2], cols[2]], 1 - g / 0.45);
      burst(x, y, g / 0.3, 60 * pw, 12 + 4 * pw, ih(fl(x), fl(y), seed) * TAU, [cols[0], cols[1]], 3);
    }
    for (let k = 0; k < 14 + 8 * pw; k++) {
      const a = dir === undefined ? ih(k, 1, seed) * TAU : dir + (ih(k, 1, seed) - 0.5) * 1.3, v = (100 + ih(k, 2, seed) * 300) * Math.sqrt(pw), px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 120 * g * g;
      if (g < 0.6) lineP(px, py, px - Math.cos(a) * (6 + pw * 4), py - Math.sin(a) * (6 + pw * 4), g < 0.15 ? cols[0] : cols[1]);
    }
    light(x, y, 26 * pw * Math.max(0, 1 - g * 3), L_WH, 0.5);
    light(x, y, 56 * pw * Math.max(0, 1 - g * 1.8), lcol || L_WARM, 0.32);
    if (g < 0.14) GD.ca = Math.max(GD.ca, 2 * pw * (1 - g / 0.14));
    shk(Math.min(4.2, 1.8 * pw) * Math.max(0, 1 - g * 2.5));
    if (imp) h5Impact(x, y, imp === 2 ? 1 : 0, keep);
  }
  function d5Hit(x, y, t, h, hold, pw, dir, cols, seed, imp, keep, lcol) {
    const g = t < h ? -1 : t < h + hold ? 0.012 : t - h - hold * 0.7;
    if (g < 0 || g > 1.2) return;
    d5Heavy(x, y, g, pw, dir, cols, seed, d5On(t, h) ? imp : 0, keep, lcol);
    if (t >= h && t < h + hold) { shk(0.6 + pw * 0.5); GD.ca = Math.max(GD.ca, 1.2 + pw * 0.6); }
  }
  // Dawnbreak: the duel kit's fighter, plus its own light: a two-sided rim, the four sparks orbiting the halo, embers off its
  // dawn side and star-dust off its night side
  function d5Hero(keys, tt, V, o) {
    o = o || {};
    const R = h5F(keys, tt, { frz: o.frz }, V); if (!R) return R;
    const p = R.p, S = R.S, t = T_NOW, fw = p.flip ? -1 : 1;
    z5Rim(fw, -0.5, 140, Math.max(1, S * 0.7)); z5Rim(-fw, -0.2, 56, Math.max(1, S * 0.6));
    if (o.noFx) return R;
    const hx = R.x - Math.sin(p.ang) * 3 * S, hy = R.y - Math.cos(p.ang) * 3 * S, rr = 15 * S * (p.ringR === undefined ? 1 : p.ringR), ra = (p.ring === undefined ? 1 : p.ring) * (p.glow === undefined ? 1 : p.glow);
    if (ra > 0.05) {
      for (let a = 0; a < TAU; a += 0.7 / rr) { const ar = rr * 1.32, x = hx + Math.cos(a) * ar, y = hy + Math.sin(a) * ar; if (fl(a * ar / 2 - t * 9) % 3 === 0 && bay(fl(x), fl(y)) < ra) P(x, y, Math.sin(a) < 0 ? 141 : 56); }
      for (let k = 0; k < 4; k++) { const a = t * 2.2 + k * TAU / 4, ex = hx + Math.cos(a) * rr * 1.32, ey = hy + Math.sin(a) * rr * 1.32 * 0.9; if (ra > 0.3) { discF(ex, ey, 1.6 + S * 0.25, ORB[k][1]); P(ex, ey, 22); for (let q = 1; q < 5; q++) { const b = a - q * 0.09; P(hx + Math.cos(b) * rr * 1.32, hy + Math.sin(b) * rr * 1.32 * 0.9, ORB[k][q < 2 ? 2 : 1]); } light(ex, ey, 14, [L_COLD, [0.5, 1, 0.4], L_GOLD, L_VIO][k], 0.4 * ra); } }
    }
    const n = o.motes === undefined ? 22 : o.motes;
    for (let k = 0; k < n; k++) { const sd = k & 1, u = frac(ih(k, 1, 9760) + t * (0.7 + ih(k, 2, 9760) * 0.8)), sx = R.x + fw * (sd ? 1 : -1) * (6 + ih(k, 3, 9760) * 10) * S, sy = R.y + (ih(k, 4, 9760) - 0.5) * 12 * S; const x = sx + fw * (sd ? 1 : -1) * u * 6 * S - (p.vx || 0) * 0.05 * u, y = sy + (sd ? -1 : 0.6) * u * 14 * S - (p.vy || 0) * 0.05 * u; if (bay(fl(x), fl(y)) < 1 - u) P(x, y, sd ? (u < 0.4 ? 22 : 141) : (u < 0.4 ? 57 : 56)); }
    return R;
  }
  // the Hollow, with what has been broken off it
  function d5Hol(keys, tt, V, o) {
    o = o || {};
    const E = h5F(keys, tt, { frz: o.frz }, V); if (!E) return E;
    const p = E.p, S = E.S, t = T_NOW;
    z5Rim(p.flip ? 1 : -1, -0.3, 72, Math.max(1, S * 0.5));
    if (p.form === 'hollow') z5Rim(p.flip ? -1 : 1, -0.4, 75, Math.max(1, S * 0.45), 73);
    if (p.eyeC === false) { const e = h5Loc(p, E.x, E.y, S, 7.5, -2); for (let k = 0; k < 5; k++) { const a = -PI / 2 + (k - 2) * 0.7 + (p.flip ? PI : 0) * 0, L = (3 + ih(k, 1, 9765) * 4) * S; lineF(e[0], e[1], e[0] + Math.cos(a) * L, e[1] + Math.sin(a) * L, (x, y, u) => { if (SMASK[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)] && u > 0.15) P(x, y, u < 0.5 ? 107 : 104); }); } light(e[0], e[1], 12 * S, L_CRIM, 0.6); for (let k = 0; k < 6; k++) { const u = frac(ih(k, 1, 9766) + t * 1.4); P(e[0] + (ih(k, 2, 9766) - 0.5) * 3 * S, e[1] + u * 9 * S, k & 1 ? 104 : 102); } }
    if (p.cut > 0) { const a = h5Loc(p, E.x, E.y, S, -16, 1.5 + p.cut * 0), b = h5Loc(p, E.x, E.y, S, 16, -1.5); lineF(a[0], a[1], b[0], b[1], (x, y) => { if (SMASK[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)]) { P(x, y, fl(t * 20 + x) % 3 ? 22 : 75); P(x, y + 1, 74); } }); light((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 20 * S, L_MAG, 0.4); }
    if (p.stump) { const s = E.hand; for (let k = 0; k < 10; k++) { const u = frac(ih(k, 1, 9767) + t * 1.8); if (bay(k, fl(t * 30)) < 1 - u) { P(s[0] + (ih(k, 2, 9767) - 0.5) * 2 * S + u * 4 * S * (p.flip ? -1 : 1), s[1] + u * 10 * S + Math.sin(u * 6 + k) * 2, k % 4 ? 0 : 74); } } }
    return E;
  }
  /* a pane of sky: a sheet of glass seen from below, a world vivid in it. P: { wx, wy, w, dh, tilt, view, hit, ui, vi, seed }.
     Before the hit it bows and cracks from (ui, vi); after it, it is a burst of shards (radial wedges in rings), each carrying
     its piece of the world, flung out from the blow and up with it. front: draw only the shards coming at the camera. */
  const d5PaneSh = {};
  function d5PaneSet(Q) {
    if (d5PaneSh[Q.seed]) return d5PaneSh[Q.seed];
    const N = 13, RG = [0, 0.16, 0.42, 1], A = [], out = [];
    for (let k = 0; k <= N; k++) A.push((k + (k < N ? (ih(k, Q.seed, 9770) - 0.5) * 0.5 : 0)) / N * TAU - PI / 2);
    const bd = (a) => { const c = Math.cos(a), s = Math.sin(a), tx = c > 1e-6 ? (1 - Q.ui) / c : c < -1e-6 ? -Q.ui / c : 1e9, ty = s > 1e-6 ? (1 - Q.vi) / s : s < -1e-6 ? -Q.vi / s : 1e9; return Math.min(tx, ty); };
    const pt = (a, r) => { const b = bd(a); return [Q.ui + Math.cos(a) * r * b, Q.vi + Math.sin(a) * r * b]; };
    const cor = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => [u, v, Math.atan2(v - Q.vi, u - Q.ui)]);
    for (let k = 0; k < N; k++) for (let j = 0; j < 3; j++) {
      const a0 = A[k], a1 = A[k + 1], rj = RG[j] * (j ? 0.85 + 0.3 * ih(k, j, 9771) : 1), rn = j + 1 === 3 ? 1 : RG[j + 1] * (0.85 + 0.3 * ih(k, j + 1, 9771));
      const poly = []; if (j === 0) poly.push([Q.ui, Q.vi]); else poly.push(pt(a0, rj));
      poly.push(pt(a0, rn));
      if (j + 1 === 3) for (const [u, v, ca] of cor) { let d = ca - a0; d = ((d % TAU) + TAU) % TAU; let dd = a1 - a0; dd = ((dd % TAU) + TAU) % TAU; if (d > 0 && d < dd) poly.push([u, v]); }
      poly.push(pt(a1, rn)); if (j > 0) poly.push(pt(a1, rj));
      let cu = 0, cv = 0; for (const [u, v] of poly) { cu += u / poly.length; cv += v / poly.length; }
      out.push({ poly, cu, cv, ring: j, k, sp: 0.6 + ih(k, j, 9772) * 0.8, rot: (ih(k, j, 9773) - 0.5) * 9, grow: ih(k, j, 9774) < 0.3 ? 1.6 : 0, front: ih(k, j, 9775) < 0.3 });
    }
    return (d5PaneSh[Q.seed] = out);
  }
  function d5PaneQ(Q, u, v) { // uv → world
    const hw = Q.w / 2, fx = hw * 0.78, x = lerp(lerp(-fx, fx, u), lerp(-hw, hw, u), v), y = lerp(-Q.dh, Q.dh, v) + Math.sin(u * PI) * (Q.bow || 0), c = Math.cos(Q.tilt), s = Math.sin(Q.tilt);
    return [Q.wx + x * c - y * s, Q.wy + x * s + y * c];
  }
  function d5Pane(t, V, Q, front) {
    const g = t - Q.hit, Wv = wview(Q.view), z = V.z;
    const ax0 = (wx, wy) => [240 + (wx - Q.wx) * z * 0.9, 135 + (wy - Q.wy) * z * 0.9];
    if (g < 0) {
      if (front) return;
      const pts = [[0, 0], [0.25, 0], [0.5, 0], [0.75, 0], [1, 0], [1, 1], [0.75, 1], [0.5, 1], [0.25, 1], [0, 1]].map(([u, v]) => { const [wx, wy] = d5PaneQ(Q, u, v); return [vX(V, wx), vY(V, wy)]; });
      if (pts.every((q) => q[1] > H - LB + 4) || pts.every((q) => q[1] < LB - 4)) return;
      h5Shard(pts, Wv, 240, 135, t, { th: 5 * z, seed: Q.seed });
      // the light of that world on this one
      const [cx, cy] = d5PaneQ(Q, 0.5, 0.5); light(vX(V, cx), vY(V, cy), 160 * z, Q.lc || L_COLD, 0.25);
      if (g > -0.14) { const u = 1 + g / 0.14, sh = d5PaneSet(Q), [ix, iy] = d5PaneQ(Q, Q.ui, Q.vi); for (const s of sh) { if (s.ring > fl(u * 3)) continue; for (let i = 0; i < s.poly.length; i++) { const a = s.poly[i], b = s.poly[(i + 1) % s.poly.length], [wa, wb] = d5PaneQ(Q, a[0], a[1]), [wc, wd] = d5PaneQ(Q, b[0], b[1]); lineP(vX(V, wa), vY(V, wb), vX(V, wc), vY(V, wd), s.ring < 1 ? 22 : 135); } } sparkle(vX(V, ix), vY(V, iy), 4 + 8 * u, 22, 135); light(vX(V, ix), vY(V, iy), 60, L_WH, 0.5 * u); }
      return;
    }
    if (g > 1.0) return;
    const sh = d5PaneSet(Q), [iwx, iwy] = d5PaneQ(Q, Q.ui, Q.vi);
    for (const s of sh) {
      if (!!front !== s.front) continue;
      const [cwx, cwy] = d5PaneQ(Q, s.cu, s.cv), dx = cwx - iwx, dy = cwy - iwy, dl = Math.hypot(dx, dy) || 1, sp = (s.ring === 0 ? 520 : s.ring === 1 ? 380 : 260) * s.sp;
      const e = 1 - Math.exp(-g * 3.2), gone = clip01(0.55, 1.0, g), ox = dx / dl * sp * e / 3.2 * 1.4, oy = dy / dl * sp * e / 3.2 * 0.8 - (s.ring === 0 ? 1500 : s.ring === 1 ? 1150 : 820) * e / 3.2 - 380 * g + 120 * g * g;
      const rot = s.rot * g, sc = Math.max(0.05, (1 + s.grow * g * 1.6) * (1 - gone)), c = Math.cos(rot), sn = Math.sin(rot);
      const scx = vX(V, cwx + ox), scy = vY(V, cwy + oy);
      if (scy < LB - 120 || scy > H - LB + 120 || scx < -160 || scx > W + 160) continue;
      const pts = s.poly.map(([u, v]) => { const [wx, wy] = d5PaneQ(Q, u, v), lx = (wx - cwx) * z * sc, ly = (wy - cwy) * z * sc; return [scx + lx * c - ly * sn, scy + lx * sn + ly * c]; });
      const [ax, ay] = ax0(cwx, cwy);
      h5Shard(pts, Wv, ax, ay, t, { th: 3 * z * sc, seed: s.k * 3 + s.ring + Q.seed, glint: s.ring === 2 && s.k % 3 === 0 });
    }
    if (!front) {
      // glass dust thrown with them
      for (let k = 0; k < 50; k++) { const a = -PI / 2 + (ih(k, 1, 9776 + Q.seed) - 0.5) * 3.4, v = 120 + ih(k, 2, 9776 + Q.seed) * 420, x = vX(V, iwx) + Math.cos(a) * v * g * z, y = vY(V, iwy) + (Math.sin(a) * v * g + 260 * g * g) * z; if (g < 0.9 && bay(k, fl(t * 30)) < 1 - g) { P(x, y, k % 4 ? 135 : 22); if (k % 5 === 0) P(x + 1, y, 136); } }
      if (g < 0.35) { const u = g / 0.35; shockRing(vX(V, iwx), vY(V, iwy), 10 + u * 300 * z, 4 + u * 70 * z, 3, [22, 135, 136], 1 - u); }
    }
  }
  WORLDS.d5line = Object.assign(() => d5World(1.0, V0, {}), { paint: d5World, fore: d5Fore, stop: d5Stop, held: d5Held, hit: d5Hit, heavy: d5Heavy, hero: d5Hero, hol: d5Hol, horizon: d5Horizon, on: d5On, D5 });

  /* ---------------------------------------------------------------- 23.0–24.5: the form */
  const PH = [276, 181], HILT = [224, 70], TIP = [262, 216], PSL = 210, SHO = [245, 152];
  const tH = TR([
    { t: 23.0, x: 276, y: 176, S: 3, form: 'dawn', sw: 0.5, swl: 3, a: 0.04, sq: 0.16, arm2: [-2.25, 10, 1], eyes: 'glow', spread: 0, ring: 0, ringR: 0.3, cr: 1, aur: 0.7, nobob: true, legs: [1, 0, 0, 1] },
    { t: 23.14, y: 171, sq: -0.24, aur: 0.8, ring: 0.5, ringR: 0.8, e: 'o' },
    { t: 23.45, y: 170, sq: 0, spread: 0.25, ring: 0.8, ringR: 0.95, cr: 0.8 },
    { t: 23.62, arm2: null, y: 166, spread: 0.5, sw: 0.9, legs: null, nobob: false },
    { t: 23.95, x: 266, y: 136, a: -0.06, spread: 1.4, ring: 1, ringR: 1.15, cr: 0.25, sw: -0.4, aur: 0.8, e: 'o' },
    { t: 24.05, sw: -1.25, swl: 3 },
    { t: 24.38, swl: 30, sw: -1.4, ringR: 1, spread: 1.1 },
    { t: 24.5, x: 262, y: 132, sw: -0.7, cr: 0, a: 0, spread: 1, aur: 0.5 },
  ]);
  const tE = TR([
    { t: 23.0, x: 173, y: 72, S: 3, form: 'hnova', nosw: true, arm: 0.5, a: 0.14, eyes: 'wide', spread: 1, flap: 0.14 },
    { t: 23.035, x: 168, y: 70, a: 0.3 },
    { t: 23.35, x: 40, y: 20, a: -1.6, spread: 0.4, sq: 0.2, alpha: 1, e: 'o' },
    { t: 23.5, x: 10, y: 10, a: -2.4, alpha: 0, hide: true },
  ]);
  const tE2 = TR([   // the shadow pours itself back together, over there
    { t: 24.0, x: 452, y: 104, S: 2.6, form: 'hnova', sw: -1.6, a: 0.1, flip: true, eyes: 'narrow', spread: 0, aur: 0, glow: 0, sq: -0.3, ws: 0.72, hide: true },
    { t: 24.2, hide: false, sq: -0.3, spread: 0.2 },
    { t: 24.34, spread: 1, aur: 1, glow: 1, sq: 0.15, a: -0.15, e: 'o' },
    { t: 24.5, x: 440, y: 110, sq: 0, sw: -2.0, a: 0 },
  ]);
  function tView(t) {
    const kk = kick(t, [[23.0, 1.5, -PI / 2], [23.62, 1.2, 0]]), u = eio(clip01(23.03, 23.55, t)), v = eio(clip01(23.55, 24.4, t));
    return { x: lerp(lerp(250, 256, u), 290, v) - kk[2], y: lerp(lerp(140, 138, u), 124, v) - kk[3], z: lerp(lerp(1, 1.3, u), 0.86, v) * (1 + kk[0] * 0.6), r: kk[1] };
  }
  // the old picture, redrawn as light: within R the new world, a band of the old one traced in line, beyond it the old
  function tSweep(t, V, R, cx, cy) {
    H5NEW.set(BUF); const nl = LIGHTS.length; WORLDS.pin(); LIGHTS.length = nl; H5OLD.set(BUF);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, d = Math.hypot(x - cx, (y - cy) * 1.25) + (vn(x, y, 9, 9780) - 0.5) * 16;
      if (d < R || (x - 163) * (x - 163) + (y - 67) * (y - 67) < 3600 * clip01(23.0, 23.07, t)) { BUF[i] = H5NEW[i]; continue; }
      if (d < R + 4) { BUF[i] = d < R + 1.5 ? 22 : bay(x, y) < 0.6 ? 140 : 141; continue; }
      if (d < R + 40) { const a = LUMP5[H5OLD[i]], b = LUMP5[H5OLD[i + 1]], c = LUMP5[H5OLD[i + W]], e = Math.abs(a - b) + Math.abs(a - c), f = (d - R) / 40; BUF[i] = e > 26 ? (f < 0.4 ? 141 : x < cx ? 56 : 110) : f > 0.7 && bay(x, y) < (f - 0.7) * 3 ? H5OLD[i] : (a > 120 && bay(x, y) < 0.25 ? 139 : 0); continue; }
      BUF[i] = H5OLD[i];
    }
    for (let k = 0; k < 90; k++) { const a = ih(k, 1, 9781) * TAU, r = R + 2 + frac(ih(k, 2, 9781) + t * 3) * 16, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r / 1.25 - frac(ih(k, 2, 9781) + t * 3) * 8; if (y > LB && y < H - LB) P(x, y, k % 3 ? 141 : 22); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; light(cx + Math.cos(a) * R, cy + Math.sin(a) * R / 1.25, 50, L_GOLD, 0.4); }
  }
  shot(23.0, 24.5, (lt, t) => {
    const HS = [[23.0, 0.1]], V = tView(t), tt = d5Stop(t, HS), g = t - 23.0;
    H5PX = V.x * 0.3; H5PY = V.y * 0.3;
    d5World(t, V, { burn: eoc(clip01(23.0, 23.6, t)), sunX: 372 });
    const hx0 = vX(V, PH[0]), hy0 = vY(V, PH[1] - 14);
    if (g < 0.72) tSweep(t, V, 18 + 620 * Math.pow(g / 0.72, 1.35), hx0, hy0);
    // the slab, now a drawing of itself; it breaks as the hero leaves it
    { const br = clip01(23.62, 24.3, t), pts = slabPts(vX(V, 110), vX(V, 410), vY(V, PSL), 0, 50 * V.z, 31);
      for (const sd of [-1, 1]) { const ox = sd * 40 * eoc(br) * V.z, oy = 60 * br * br * V.z, rot = sd * 0.25 * br; const cxp = vX(V, 260), cyp = vY(V, PSL); const q = pts.filter((p) => (p[0] - cxp) * sd >= -2).concat([[cxp + sd * 2, cyp + 50 * V.z * 0.8]]).map(([x, y]) => { const lx = x - cxp, ly = y - cyp; return [cxp + lx * Math.cos(rot) - ly * Math.sin(rot) + ox, cyp + lx * Math.sin(rot) + ly * Math.cos(rot) + oy]; });
        if (g >= 0) { polyF(q, (x, y) => ((x + y) % 4 === 0 ? 139 : 0)); for (let i = 0, j = q.length - 1; i < q.length; j = i++) lineP(q[j][0], q[j][1], q[i][0], q[i][1], q[j][1] < cyp + 2 && q[i][1] < cyp + 2 ? 22 : 135); } }
      if (br > 0) rocks(vX(V, 260), vY(V, PSL), t - 23.62, 14, 120, 3 * V.z, [137, 136, 135, 22], 9782, 200, PI / 2, 2.4);
    }
    const HR0 = h5Pose(tH, tt), shx = vX(V, SHO[0]), shy = vY(V, SHO[1] - (176 - HR0.y));
    // the burst that throws the Hollow off it
    d5Hit(hx0, hy0, t, 23.0, 0.1, 2.2, undefined, [22, 140, 56], 9789, 1, [140, 141, 56, 57, 73, 74, 104], L_GOLD);
    const E = h5F(tE, tt, {}, V);
    if (E) h5Ash(tE, tt, V, 30, -60, -40, [0, 78, 20, 0, 22, 77]);
    // and pouring itself back together on the far side
    if (t > 23.8) { ashStreams(t, vX(V, 452), vY(V, 104), 160, clip01(23.8, 24.2, t) * (1 - clip01(24.25, 24.5, t)), 9790); d5Hol(tE2, tt, V); const g2 = t - 24.2; if (g2 >= 0 && g2 < 0.35) { shockRing(vX(V, 452), vY(V, 104), 6 + g2 * 260, 4 + g2 * 160, 3, [22, 74, 72], 1 - g2 / 0.35); light(vX(V, 452), vY(V, 104), 60, L_MAG, 0.6 * (1 - g2 / 0.35)); } }
    // the hero
    const HR = d5Hero(tH, tt, V, { frz: d5Held(t, HS) ? 2 : 0 });
    // the pinning blade: its black runs down into the hero; it cracks with light, empties from the hilt down, and crumbles
    const hx = vX(V, HILT[0]), hy = vY(V, HILT[1]), ba = Math.atan2(shy - hy, shx - hx), bl = Math.hypot(shx - hx, shy - hy) + 22 * V.z;
    const drain = clip01(23.0, 23.5, t), crum = clip01(23.47, 23.8, t);
    if (crum < 1) {
      const s0 = eic(drain) * 0.7 * bl;
      if (crum <= 0) { bigBlade(hx + Math.cos(ba) * s0, hy + Math.sin(ba) * s0, ba, bl - s0, 7.5 * V.z * (1 - 0.3 * drain), t, { form: 'void', flare: 0.4, cracks: 0.6 + drain * 3.2, noHilt: s0 > 4 }); for (let q = 0; q < 5; q++) { const f = (q + 0.5) / 5, along = lerp(s0, bl, f); light(hx + Math.cos(ba) * along, hy + Math.sin(ba) * along, 34 * V.z, L_MAG, 0.35 * (1 - drain * 0.5)); }
        for (let k = 0; k < 6; k++) { let x = shx, y = shy, d = 0; const reach = (bl - s0) * clip01(0, 0.4, g) * (0.5 + ih(k, 1, 9783) * 0.5); while (d < reach) { const st = 6 + ih(k, fl(d), 9784) * 8, off = (ih(k, fl(d) + 1, 9785) - 0.5) * 6 * V.z, nx = shx - Math.cos(ba) * (d + st) - Math.sin(ba) * off, ny = shy - Math.sin(ba) * (d + st) + Math.cos(ba) * off; lineP(x, y, nx, ny, 22); x = nx; y = ny; d += st; } }
        for (let k = 0; k < 60; k++) { const u = frac(ih(k, 1, 9786) + t * (1.6 + ih(k, 2, 9786))), along = lerp(s0, bl - 10 * V.z, u), q = (ih(k, 3, 9786) - 0.5) * 9 * V.z, px = hx + Math.cos(ba) * along - Math.sin(ba) * q * (1 - u), py = hy + Math.sin(ba) * along + Math.cos(ba) * q * (1 - u); lineP(px, py, px - Math.cos(ba) * 5 * V.z, py - Math.sin(ba) * 5 * V.z, k % 4 === 0 ? 74 : k % 4 === 1 ? 77 : 0); }
      } else {
        // the pieces of it, pulled in a spiral into the night half
        for (let k = 0; k < 18; k++) { const f = (k + 0.5) / 18, along = lerp(s0, bl, f), px0 = hx + Math.cos(ba) * along, py0 = hy + Math.sin(ba) * along, d = clamp(crum * 1.5 - (1 - f) * 0.5, 0, 1), e = eic(d), a = ba + d * 5, rr = (1 - e) * 22 * V.z; if (d >= 1) continue;
          const x = lerp(px0, shx - 8 * V.z, e) + Math.cos(a) * rr, y = lerp(py0, shy, e) + Math.sin(a) * rr, r = (3 + ih(k, 1, 9787) * 3) * V.z * (1 - e * 0.8); const pts = shardPts(x, y, r * 1.4, r, a * 2 + k, 90 + k, 5); polyF(pts, (X, Y) => (bay(X, Y) < 0.15 ? 77 : 0)); for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) lineP(pts[j][0], pts[j][1], pts[i][0], pts[i][1], k % 3 ? 74 : 22); }
      }
    }
    if (t < 23.62) { light(shx, shy, 40 * V.z, L_DARK, 0.4 * (1 - drain)); sparkle(shx, shy, 4 + 3 * Math.sin(t * 30), 22, 140); }
    // the new blade gathers out of light and dark into the hilt
    if (t > 23.95 && t < 24.45) { const u = clip01(23.95, 24.4, t); for (let k = 0; k < 40; k++) { const f = frac(ih(k, 1, 9791) + t * 2.4), a = ih(k, 2, 9791) * TAU, r = 40 * (1 - f) * V.z; P(HR.tip[0] + Math.cos(a) * r, HR.tip[1] + Math.sin(a) * r, k & 1 ? 22 : 57); if (k % 3 === 0) P(HR.hand[0] + Math.cos(a) * r * 0.6, HR.hand[1] + Math.sin(a) * r * 0.6, k & 2 ? 141 : 56); } light(HR.tip[0], HR.tip[1], 40, L_WH, 0.7 * (1 - u * 0.5)); sparkle(HR.tip[0], HR.tip[1], 6 * (1 - u) + 2, 22, 140); }
    d5Fore(t, V, { amt: clip01(23.3, 23.9, t) });
    if (V.r) z5Cam(1, V.r, 240, 135);
  });
  CAPS.push([23.0, 24.45, 'x', 'dawn', 'DAWNBREAK!!', 218]);

  /* ---------------------------------------------------------------- 24.5–27.0: the counter-attack, cut on each impact */
  const S2 = 2.4;
  const cH = TR([
    { t: 24.5, x: 214, y: 134, S: S2, form: 'dawn', sw: -0.7, swl: 30, a: 0, sq: 0, flip: false, eyes: 'glow', spread: 1, aur: 0.45, ws: 0.7 },
    { t: 24.62, x: 212, y: 140, sq: 0.25, sw: -0.4 },
    { t: 24.8, x: 204, y: 170, sq: 0.48, a: 0.16, sw: 1.5, spread: 0.5, e: 'o' },             // under its sweep
    { t: 24.94, x: 208, y: 166, sq: 0.52, a: 0.1, sw: 1.7 },
    { t: 25.0, x: 222, y: 138, sw: -1.75, sq: -0.28, a: -0.2, spread: 1.2, e: EQ },          // 1: a rising cut across the mask
    { t: 25.1, x: 228, y: 126, sw: -2.3, a: -0.25, sq: 0, e: 'o' },
    { t: 25.28, x: 238, y: 62, sw: -2.95, a: -0.12, sq: 0.18, spread: 1.4 },
    { t: 25.4, x: 252, y: 90, sw: 1.05, a: 0.3, sq: -0.22, e: EQ },                          // 2: the chop on the blade arm
    { t: 25.5, x: 256, y: 100, sw: 1.6, a: 0.34, sq: 0.22, e: 'o' },
    { t: 25.58, x: 286, y: 50, a: 1.6, sw: 0.2, sq: -0.1, e: 'i' },
    { t: 25.7, x: 372, y: 42, a: 6.68, sw: 0.9, sq: 0, e: 'l' },                              // 3: vaulting it, through its wing
    { t: 25.7001, a: 0.4 },
    { t: 25.8, x: 414, y: 90, a: 0.1, sq: 0.12, e: 'o' },
    { t: 25.8001, flip: true, a: -0.1, sw: 0.5 },
    { t: 25.93, x: 472, y: 118, a: 0.1, sw: 0.25, sq: 0.3, reach: 0 },
    { t: 26.0, x: 452, y: 124, sw: 0.02, reach: 6, sq: -0.28, a: -0.05, e: EQ },              // 4: the thrust into the crimson eye
    { t: 26.06, x: 450, y: 122, reach: 3, sw: -0.15, sq: 0, e: 'o' },
    { t: 26.2, x: 398, y: 118, a: 7.5, lk: 1, sq: -0.15, sw: -1.4, reach: 0, e: 'i' },        // 5: the spinning kick
    { t: 26.2001, a: 1.22 },
    { t: 26.28, x: 404, y: 116, a: 0.5, lk: 0.3, sq: 0.1, e: 'o' },
    { t: 26.35, x: 414, y: 120, a: 0, lk: 0, sw: 0.3, sq: 0.38 },
    { t: 26.4, x: 318, y: 136, sw: 0.12, sq: -0.42, reach: 4, e: 'l' },                       // 6: through it
    { t: 26.47, x: 176, y: 144, sw: 0.4, sq: -0.1, reach: 0, e: 'o' },
    { t: 26.62, x: 156, y: 150, sw: 0.7, sq: 0.1 },
    { t: 26.6201, flip: false, sw: 1.2 },
    { t: 26.8, x: 250, y: 190, sq: 0.45, sw: 1.7, a: -0.08, arm2: [2.7, 6, 1], spread: 0.7 },
    { t: 26.96, x: 256, y: 192, sq: 0.56, sw: 1.8, a: -0.12 },
    { t: 27.0, x: 262, y: 160, sq: -0.36, a: 0.12, sw: 1.2, arm2: [-1.72, 12, 1], spread: 1.3, e: EQ },   // the uppercut
    { t: 27.12, x: 262, y: 120, sq: -0.1, e: 'o' },
  ], { 25.28: 26, 25.7: 40, 26.4: -10, 26.8: -22 });
  const cE = TR([
    { t: 24.5, x: 430, y: 110, S: S2, form: 'hnova', sw: -2.0, a: 0, flip: true, eyes: 'narrow', spread: 1, chip: 0, aur: 0.5, ws: 0.55 },
    { t: 24.64, x: 356, y: 112, sw: -2.4, a: -0.2, sq: -0.12 },
    { t: 24.8, x: 300, y: 122, sw: 0.1, a: 0.2, sq: 0.1, e: EQ },                              // its sweep, over the hero
    { t: 24.95, x: 314, y: 124, sw: 0.8, a: 0.1, sq: 0, e: 'o' },
    { t: 25.0, x: 318, y: 124, eyes: 'wide' },
    { t: 25.1, x: 340, y: 112, a: 0.5, chip: 1, sq: 0.12, e: 'o' },                            // head snapped back
    { t: 25.3, x: 338, y: 120, a: 0.08, sw: -1.7, sq: 0 },                                     // raises its blade again
    { t: 25.4, x: 336, y: 126, sw: -1.2, a: 0.02 },
    { t: 25.4001, nosw: true, reach: -3, stump: 1 },
    { t: 25.5, x: 342, y: 140, a: -0.3, sq: 0.26, e: 'o' },                                    // the arm gone, driven down
    { t: 25.7, x: 344, y: 132, a: 0.06, sq: 0 },
    { t: 25.7001, wl: 0 },
    { t: 25.8, x: 336, y: 140, a: -0.34, sq: 0.14, e: 'o' },
    { t: 25.9, x: 340, y: 130, a: 0, sq: 0 },
    { t: 25.9001, flip: false, eyes: 'wide' },                                                  // turns to face it
    { t: 26.0, x: 340, y: 128 },
    { t: 26.0001, eyeC: false, eyes: 'narrow' },
    { t: 26.08, x: 330, y: 124, a: -0.42, sq: 0.1, e: 'o' },
    { t: 26.2, x: 340, y: 128, a: -0.1 },
    { t: 26.28, x: 300, y: 140, a: 0.6, sq: 0.4, aur: 0.3, e: 'o' },                            // folded by the kick
    { t: 26.4, x: 276, y: 140, a: 0.3, sq: 0.15 },
    { t: 26.4001, form: 'hollow', spread: 0, cut: 1, eyes: 'wide' },
    { t: 26.6, x: 262, y: 128, a: -0.45, sq: 0.1, e: 'o' },
    { t: 26.95, x: 240, y: 114, a: 0.25, sq: 0 },
    { t: 27.0, x: 236, y: 112, a: 0.1, sq: 0.42, e: 'l' },
    { t: 27.25, x: 240, y: -120, a: -3, sq: -0.2, e: 'o' },
  ]);
  const CH = [[25.0, 0.067], [25.4, 0.1], [25.7, 0.1], [26.0, 0.134], [26.2, 0.134], [26.4, 0.167], [27.0, 0.134]];
  // the cameras: one set-up per strike
  const CAMS = [
    [24.5, (t) => ({ x: lerp(286, 272, eio(clip01(24.5, 25.0, t))), y: 134, z: lerp(0.98, 1.06, eio(clip01(24.5, 25.0, t))), r: 0 })],
    [25.0, (t) => ({ x: lerp(280, 296, clip01(25.0, 25.4, t)), y: 116, z: 1.15, r: -0.05 })],
    [25.4, (t) => ({ x: 312, y: lerp(108, 118, clip01(25.4, 25.7, t)), z: 1.08, r: 0.09 })],
    [25.7, (t) => ({ x: lerp(366, 380, clip01(25.7, 26.0, t)), y: 102, z: 0.95, r: -0.03 })],
    [26.0, (t) => ({ x: lerp(364, 358, clip01(26.0, 26.2, t)), y: 122, z: 2.4, r: 0.05 })],
    [26.2, (t) => ({ x: lerp(362, 340, clip01(26.2, 26.4, t)), y: 126, z: 1.08, r: -0.12 })],
    [26.4, (t) => ({ x: lerp(272, 250, eio(clip01(26.4, 27.0, t))), y: lerp(136, 146, eio(clip01(26.6, 27.0, t))), z: lerp(0.95, 1.18, eio(clip01(26.55, 27.0, t))), r: 0 })],
  ];
  const CKD = [[25.0, 1.4, -0.6], [25.4, 1.6, 1.3], [25.7, 1.4, 0.8], [26.0, 1.8, PI], [26.2, 1.8, PI + 0.2], [26.4, 2.0, PI], [27.0, 2.8, -PI / 2]];
  function cView(t) {
    let f = CAMS[0][1]; for (const [t0, fn] of CAMS) if (t >= t0) f = fn;
    const V = f(t), kk = kick(t, CKD);
    return { x: V.x - kk[2] / V.z, y: V.y - kk[3] / V.z, z: V.z * (1 + kk[0] * 0.8), r: V.r + kk[1] };
  }
  shot(24.5, 27.0, (lt, t) => {
    const V = cView(t), tt = d5Stop(t, CH), frz = d5Held(t, CH) ? 1.5 : 0;
    H5PX = V.x * 0.3; H5PY = V.y * 0.3;
    d5World(t, V, {});
    const pe = h5Pose(cE, tt);
    // 3: the wing it lost, falling, burning out
    let g = tt - 25.7; if (g >= 0 && g < 1.3) { const wx = vX(V, 372 + 40 * g), wy = vY(V, 112 - 30 * g + 160 * g * g); h5Wing(wx, wy, S2 * 0.55 * V.z, t, 1, 0.05, 1, 'void', g * 3 + 0.4, 0, 0, clip01(0.25, 1.2, g) * 0.95); }
    // 2: the arm it lost, and its blade, spinning away
    g = tt - 25.4; if (g >= 0 && g < 1.2) { const ax = vX(V, 300 - 40 * g), ay = vY(V, 128 + 60 * g + 200 * g * g), aa = 2.2 + g * 9, L = 6 * S2 * V.z; capsF(ax, ay, ax + Math.cos(aa) * L, ay + Math.sin(aa) * L, 2.2 * V.z, 2.2 * V.z, (u, d) => (d > 0.7 ? 22 : 134)); bigBlade(ax + Math.cos(aa) * L, ay + Math.sin(aa) * L, aa + 0.5, 64 * V.z, 3.2 * V.z, t, { form: 'void', flare: 0.4 * (1 - g), cracks: g * 2 }); h5Void(t); }
    const E = d5Hol(cE, tt, V, { frz });
    if (E) h5Ash(cE, tt, V, t > 26.4 ? 46 : 16, t > 26.4 ? -70 : 20, -40, [0, 78, 20, 0, 22, 77]);
    const HR = d5Hero(cH, tt, V, { frz });
    // the strikes
    const at = (wx, wy) => [vX(V, wx), vY(V, wy)];
    { const [x, y] = at(290, 112); d5Hit(x, y, t, 25.0, 0.067, 1.1, -0.6, [22, 140, 56], 9800, 1, [140, 141, 64, 65, 73, 104], L_GOLD); g = tt - 25.0;
      if (g > 0 && g < 1) { rocks(x, y, g, 12, 220, 2.6 * V.z, [66, 65, 64, 22], 9801, 220, -0.7, 1.4); const mx = x + 140 * g * V.z, my = y - 120 * g * V.z + 200 * g * g * V.z; z5MaskShard(mx, my, 0.3 * V.z, g * 12, 0, [0, 0], t); } }
    { const [x, y] = at(302, 126); d5Hit(x, y, t, 25.4, 0.1, 1.3, 1.3, [22, 74, 72], 9802, 0, null, L_MAG); g = tt - 25.4; if (g > 0 && g < 0.7) for (let k = 0; k < 24; k++) { const a = 1.3 + (ih(k, 1, 9803) - 0.5) * 1.6, v = (80 + ih(k, 2, 9803) * 240) * V.z, px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 160 * g * g; if (bay(k, fl(t * 30)) < 1 - g) rectF(px, py, 2, 2, k % 3 ? 0 : 74); } }
    { const [x, y] = at(368, 100); d5Hit(x, y, t, 25.7, 0.1, 1.2, 0.8, [22, 140, 56], 9804, 1, [140, 141, 56, 57, 73, 74], L_GOLD); g = tt - 25.7;
      if (g > 0 && g < 0.9) for (let q = 0; q < 16; q++) { const a = ih(q, 1, 9805) * TAU, r = (30 + ih(q, 2, 9805) * 110) * g * V.z, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r + 120 * g * g * V.z; z5Kite(px, py, a + g * 6, 8 * V.z * (1 - g), 2.2, q % 3 ? 0 : 78); } }
    { const eye = E ? h5Loc(pe, E.x, E.y, E.S, 7.5, -2) : at(338, 124); d5Hit(eye[0], eye[1], t, 26.0, 0.134, 1.5, PI, [22, 104, 102], 9806, 1, [104, 107, 103, 102, 22], L_CRIM); g = tt - 26.0;
      if (g > 0 && g < 0.6) { rocks(eye[0] - 8 * V.z, eye[1], g, 14, 300, 2.2 * V.z, [102, 104, 107, 22], 9807, 240, PI, 1.2); for (let q = 0; q < 20; q++) { const a = PI + (ih(q, 1, 9808) - 0.5) * 1.4, v = 120 + ih(q, 2, 9808) * 340, px = eye[0] + Math.cos(a) * v * g * V.z, py = eye[1] + Math.sin(a) * v * g * V.z + 100 * g * g; lineP(px, py, px - Math.cos(a) * 8, py - Math.sin(a) * 8, q % 3 ? 104 : 107); } } }
    { const [x, y] = at(354, 132); d5Hit(x, y, t, 26.2, 0.134, 1.2, PI + 0.2, [57, 56, 6], 9809, 0, null, L_VIO); g = tt - 26.2;
      if (g > 0 && g < 0.8) { const ox = x - 24 * V.z; for (let q = 0; q < 12; q++) { const a = PI + 0.2 + (ih(q, 1, 9810) - 0.5) * 1.5, v = (90 + ih(q, 2, 9810) * 200) * V.z, px = ox + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 140 * g * g, r = (2 + ih(q, 3, 9810) * 4) * V.z * (1 - g * 0.7), pts = shardPts(px, py, r * 1.3, r, g * 8 + q, 70 + q, 5); polyF(pts, () => 134); for (let i = 0, j = 4; i < 5; j = i++) lineP(pts[j][0], pts[j][1], pts[i][0], pts[i][1], q % 2 ? 22 : 72); } h5Void(t); } }
    { const [x, y] = at(276, 138); d5Hit(x, y, t, 26.4, 0.167, 1.3, PI, [22, 140, 74], 9811, 1, [22, 140, 141, 74], L_GOLD); g = t - 26.4;
      if (g >= 0 && g < 0.45) { const u = g / 0.45, L = 260 * (1 - u * 0.4); thick(x - L, y + 4, x + L, y - 4, u < 0.35 ? 2 : 1, 22); lineP(x - L * 0.9, y + 6, x + L * 0.9, y - 2, u < 0.5 ? 140 : 141); }
      g = tt - 26.4; if (g > 0.05 && g < 1) for (let k = 0; k < 26; k++) { const a = PI + (ih(k, 1, 9812) - 0.5) * 0.9, v = (60 + ih(k, 2, 9812) * 200) * V.z, px = x + Math.cos(a) * v * g + (ih(k, 3, 9812) - 0.5) * 30, py = y + Math.sin(a) * v * g - 40 * g * g + (ih(k, 4, 9812) - 0.5) * 30; if (bay(k, fl(t * 30)) < 1 - g) P(px, py, k % 3 ? 20 : k % 2 ? 74 : 22); } }
    // the uppercut's wind-up: light gathers at its fist
    if (t > 26.7 && HR) { const u = clip01(26.7, 27, t), f2 = h5Loc(HR.p, HR.x, HR.y, HR.S, -12 + Math.cos(2.7) * 7, -1 + Math.sin(2.7) * 7); for (let k = 0; k < 20; k++) { const f = frac(ih(k, 1, 9813) + t * 3), a = ih(k, 2, 9813) * TAU; P(f2[0] + Math.cos(a) * 34 * (1 - f) * V.z, f2[1] + Math.sin(a) * 20 * (1 - f) * V.z, k & 1 ? 22 : 56); } light(f2[0], f2[1], 70 * u, L_GOLD, 0.6 * u); sparkle(f2[0], f2[1], 2 + 5 * u, 22, 140); }
    { const [x, y] = at(232, 126); d5Hit(x, y, t, 27.0, 0.134, 2.6, -PI / 2, [22, 140, 56], 9814, 2, [140, 141, 56, 57, 73, 74], L_GOLD); }
    d5Fore(t, V, { amt: 1 });
    if (V.r) z5Cam(1, V.r, 240, 135);
  });

  /* ---------------------------------------------------------------- 27.0–29.4: the uppercut, and up through three worlds */
  const S3 = 2.6;
  const PANES = [
    { wx: 248, wy: -372, w: 620, dh: 64, tilt: 0.07, view: 'city', hit: 27.6, ui: 0.5, vi: 0.86, seed: 1, bow: 8, lc: L_COLD },
    { wx: 232, wy: -944, w: 660, dh: 84, tilt: -0.09, view: 'ink', hit: 28.2, ui: 0.48, vi: 0.86, seed: 2, bow: -10, lc: L_WH },
    { wx: 244, wy: -1530, w: 640, dh: 70, tilt: 0.11, view: 'ocean', hit: 28.8, ui: 0.52, vi: 0.86, seed: 3, bow: 12, lc: L_COLD },
  ];
  const uE = TR([
    { t: 27.0, x: 236, y: 112, S: S3, form: 'hollow', nosw: true, reach: -3, stump: 1, a: 0.1, sq: 0.42, chip: 1, eyeC: false, wl: 0, cut: 1, eyes: 'wide', flip: false, spread: 0 },
    { t: 27.25, x: 242, y: -150, a: -2.4, sq: -0.2, e: 'o' },
    { t: 27.5, x: 238, y: -290, a: -4.4, sq: 0.1 },
    { t: 27.6, x: 238, y: -305, a: -4.7, sq: 0.36, e: 'l' },
    { t: 27.76, x: 234, y: -560, a: -6.0, sq: -0.2, e: 'o' },
    { t: 28.0, x: 232, y: -760, a: -7.0, sq: 0 },
    { t: 28.16, x: 228, y: -850, a: -7.6, sq: 0.1, e: 'l' },
    { t: 28.2, x: 228, y: -863, a: -7.7, sq: 0.4, e: 'l' },
    { t: 28.36, x: 238, y: -1110, a: -9.0, sq: -0.2, e: 'o' },
    { t: 28.6, x: 242, y: -1380, a: -10.0, sq: 0 },
    { t: 28.76, x: 244, y: -1450, a: -10.6, sq: 0.1, e: 'l' },
    { t: 28.8, x: 244, y: -1459, a: -10.7, sq: 0.42, e: 'l' },
    { t: 28.98, x: 300, y: -1720, a: -12.0, sq: -0.2, e: 'o' },
    { t: 29.12, x: 336, y: -1790, a: -12.57 - 0.3, sq: 0, spread: 0.2, flip: true, form: 'hnova', reach: -3 },
    { t: 29.3, x: 344, y: -1800, a: 0.2 - 12.57, sq: 0.2, spread: 1, reach: 0, stump: 0 },
    { t: 29.4, x: 340, y: -1796, a: -0.25 - 12.57, sq: -0.2, e: EQ },
  ]);
  const uH = TR([
    { t: 27.0, x: 262, y: 160, S: S3, form: 'dawn', sw: 1.2, swl: 30, sq: -0.36, a: 0.12, flip: false, arm2: [-1.72, 12, 1], spread: 1.3, aur: 0.45 },
    { t: 27.2, x: 258, y: 20, sq: -0.1, e: 'o' },
    { t: 27.45, x: 250, y: -150, arm2: [2.6, 6, 1], sq: 0.28, spread: 1.4 },                  // gathers
    { t: 27.57, x: 244, y: -238, arm2: [-1.6, 9, 1], sq: -0.3, a: -0.08, e: 'i' },            // 1: a straight rising punch
    { t: 27.6, x: 242, y: -250, arm2: [-1.57, 13, 1], e: 'l' },
    { t: 27.76, x: 248, y: -430, arm2: [-1.9, 8, 1], sq: 0, a: 0, e: 'o' },
    { t: 27.95, x: 262, y: -620, a: 1.6, sq: 0.25, arm2: null, e: 'i' },                       // 2: over, and both feet
    { t: 28.17, x: 234, y: -795, a: 3.1, sq: 0.3, lk: 0.2, e: 'l' },
    { t: 28.2, x: 230, y: -806, a: 3.14, lk: 1, sq: -0.32, e: 'l' },
    { t: 28.36, x: 234, y: -1010, a: 6.0, lk: 0, sq: 0, e: 'o' },
    { t: 28.3601, a: -0.28 },
    { t: 28.6, x: 226, y: -1240, sq: 0.32, a: 0.3, spread: 0.15, sw: 1.6, e: 'i' },            // 3: wings shut, the whole body
    { t: 28.8, x: 240, y: -1417, a: 0.0, sq: -0.42, spread: 0.1, e: 'l' },
    { t: 28.96, x: 218, y: -1640, a: -0.2, sq: 0, spread: 1.3, e: 'o' },
    { t: 29.12, x: 160, y: -1786, a: 0, spread: 1.1, sw: -1.6 },
    { t: 29.3, x: 150, y: -1800, a: -0.25, sq: 0.2, sw: -2.4 },
    { t: 29.4, x: 158, y: -1794, a: 0.25, sq: -0.2, sw: -0.4, e: EQ },
  ]);
  const UH = [[27.0, 0.134], [27.6, 0.1], [28.2, 0.1], [28.8, 0.1]];
  function uView(t) {
    const ts = d5Stop(t, UH), pe = h5Trk(uE, ts), ph = h5Trk(uH, ts), kk = kick(t, [[27.0, 2.6, -PI / 2], [27.6, 1.8, -PI / 2], [28.2, 1.8, -PI / 2], [28.8, 2, -PI / 2]]);
    const top = eio(clip01(28.86, 29.36, t)), sep = Math.abs(pe.y - ph.y);
    const my = (pe.y + ph.y) / 2 + 4, mx = (pe.x + ph.x) / 2;
    const roll = t < 27.6 ? 0.05 : t < 28.2 ? -0.07 : t < 28.8 ? 0.08 : lerp(0.04, 0, top);
    return { x: lerp(lerp(246, mx, 0.3), 248, top) - kk[2], y: (t < 27.12 ? lerp(140, my, eio(clip01(27.0, 27.12, t))) : lerp(my, -1830, top)) - kk[3], z: lerp(clamp(150 / (sep + 70), 0.8, 1.0), 0.78, top) * (1 + kk[0] * 0.7), r: roll + kk[1] };
  }
  shot(27.0, 29.4, (lt, t) => {
    const V = uView(t), tt = d5Stop(t, UH), frz = d5Held(t, UH) ? 1.6 : 0;
    H5PX = V.x * 0.3; H5PY = V.y * 0.05;
    const top = eio(clip01(28.86, 29.36, t));
    d5World(t, V, { hz: lerp(200, -752, top) });
    // the climb: the line-world streaming past
    if (t > 27.08 && top < 1) for (let k = 0; k < 46; k++) { const x = ih(k, 1, 9820) * W, sp = 600 + ih(k, 2, 9820) * 900, y = ((ih(k, 3, 9820) * 420 + (t - 27) * sp) % 420) - 80, L = (24 + ih(k, 4, 9820) * 80) * (1 - top); for (let q = 0; q < L; q++) if (bay(fl(x), fl(y + q)) < 0.6 - q / L * 0.5) P(x, y + q, k % 5 === 0 ? 141 : k % 5 === 1 ? 56 : k % 5 === 2 ? 128 : 5); }
    for (const Pn of PANES) d5Pane(t, V, Pn, false);
    const E = d5Hol(uE, tt, V, { frz });
    if (E) h5Ash(uE, tt, V, 34, 0, 90, [0, 78, 121, 0, 72, 120]);
    // at the top it re-knits its arm out of the dark
    if (E && t > 28.98 && t < 29.4) { const u = clip01(29.0, 29.3, t); ashStreams(t, E.hand[0], E.hand[1], 70, 1 - u * 0.6, 9821); light(E.hand[0], E.hand[1], 30, L_MAG, 0.5); }
    const HR = d5Hero(uH, tt, V, { frz });
    // the blows
    { const p = h5Trk(uE, 27.0); d5Hit(vX(V, p.x), vY(V, p.y + 14), t, 27.0, 0.134, 2.6, -PI / 2, [22, 140, 56], 9822, 0, null, L_GOLD); }
    for (let k = 0; k < 3; k++) { const p = h5Trk(uE, PANES[k].hit); d5Hit(vX(V, p.x), vY(V, p.y + 16), t, PANES[k].hit, 0.1, 1.8, -PI / 2, [22, 140, 56], 9823 + k, 0, null, L_GOLD); }
    for (const Pn of PANES) d5Pane(t, V, Pn, true);
    // at the top: both blades race out to the length of the world
    if (t > 29.1 && HR && E) {
      const gr = eoc(clip01(29.12, 29.38, t)), ha = HR.wa, ea = E.wa;
      bigBlade(E.hand[0], E.hand[1], t < 29.3 ? -2.0 : lerp(-2.0, -PI + 0.5, clip01(29.3, 29.4, t)), 1500 * gr, 5 * V.z, t, { form: 'void', grow: gr < 1 ? 0.999 : 1, flare: 0.6, surge: true });
      bigBlade(HR.hand[0], HR.hand[1], t < 29.3 ? -1.2 : lerp(-1.2, -0.5, clip01(29.3, 29.4, t)), 1500 * gr, 5 * V.z, t, { form: 'dawn', grow: gr < 1 ? 0.999 : 1, flare: 0.6, surge: true });
    }
    d5Fore(t, V, { amt: top });
    if (V.r) z5Cam(1, V.r, 240, 135);
  });
  }

  /* ================================================================ ACT IV/V — the horizon cut; only a shadow (29.4–40.0)
     29.4 seen from far off, two blades longer than the horizon cross over the sun's rings and every shard of sky left bursts
     outward; the camera drives into the crossing, then onto the hero: its blade and its body cracking, pushed back. 31.0 the
     blade snaps, its pieces thrown at the lens; the bottom drops out. 32.0 a bare hand closes on the black blade and stops it
     dead. 33.0 FURTHER: the other hand reaches down to the horizon; the whole landscape bends toward it; the line of dawn comes
     free like a wire and is held, a blade the width of the world. 34.0 one horizontal cut: a white line on black, held three
     frames, and then everything above the line slides. The Hollow comes apart along it into ash; the sky heals shard by
     shard; what is left falls back onto the cloud as a shadow. Dawn. 38.8 the shadow's eye blinks once. */
  {
  const D5L = WORLDS.d5line, d6World = D5L.paint, d6Fore = D5L.fore, d6Stop = D5L.stop, d6Held = D5L.held, d6Hit = D5L.hit, d6Heavy = D5L.heavy, d6Hero = D5L.hero, d6Hol = D5L.hol, d6Horizon = D5L.horizon, d6On = D5L.on, D5 = D5L.D5;
  const S2 = 2.4, CX = 240, CY = 4;                                       // the crossing, in the climax's world
  /* ---------------------------------------------------------------- the fighters, 29.4–34.0 */
  const xH = TR([
    { t: 29.4, x: 20, y: 140, S: S2, form: 'dawn', nosw: true, arm: -0.5, a: 0.12, sq: -0.2, cr: 0.1, eyes: 'glow', flip: false, spread: 1.2, aur: 0.5, ws: 0.9 },
    { t: 29.6, x: 22, y: 140, a: 0.02, sq: 0.08, vib: 0.5, e: 'o' },
    { t: 30.45, x: 30, y: 128, a: -0.1, sq: 0.18, vib: 0.9, cr: 0.55, spread: 0.8 },
    { t: 30.98, x: 34, y: 127, a: -0.2, sq: 0.26, vib: 1.4, cr: 0.95, spread: 0.6, eyes: 'narrow' },
    { t: 31.0, x: 32, y: 128, e: 'l' },
    { t: 31.0001, nosw: false, sw: -0.5, swl: 7, arm: undefined },
    { t: 31.18, x: 4, y: 146, a: -1.3, sq: 0.1, vib: 0, cr: 1, spread: 0.4, sw: 0.6, e: 'o' },   // thrown back, tumbling, the stump in its hand
    { t: 31.45, x: -10, y: 160, a: -2.2, sq: 0.15, spread: 0.3, sw: 1.4, eyes: 'closed' },
    { t: 31.7, x: -4, y: 162, a: -0.9, sq: 0.1, spread: 0.6, sw: 1.0, eyes: 'narrow' },
    { t: 31.86, x: 12, y: 154, a: -0.1, sq: 0.05, arm2: [-0.4, 9, 1], eyes: 'glow' },
    { t: 32.0, x: 24, y: 152, a: 0.06, sq: -0.14, arm2: [-0.18, 16, 1], e: EQ },                // the catch
    { t: 32.2, x: 22, y: 152, sq: 0.14, vib: 0.9, e: 'o' },
    { t: 33.0, x: 30, y: 148, a: 0.04, vib: 0.5, cr: 0.8, sw: 0.9 },
    { t: 33.18, x: 32, y: 144, sw: 1.9, reach: 6, sq: -0.1 },                                    // the sword hand goes down to the horizon
    { t: 33.32, x: 34, y: 142, sw: 2.0, reach: 7, sq: 0.1, vib: 0.8 },
    { t: 33.62, x: 36, y: 136, sw: -0.3, reach: 2, sq: -0.15, a: -0.1, vib: 0.4 },               // it comes up: the line of dawn in its hand
    { t: 33.86, x: 30, y: 138, sw: 0.75, reach: 0, a: -0.22, sq: 0.3, vib: 0.2 },                // coiled
    { t: 34.0, x: 48, y: 140, sw: -0.15, a: 0.3, sq: -0.3, vib: 0, e: EQ },
  ]);
  const xE = TR([
    { t: 29.4, x: 460, y: 140, S: S2, form: 'hnova', nosw: true, arm: -0.5, a: -0.12, sq: -0.2, flip: true, spread: 1, wl: 0, chip: 1, eyeC: false, eyes: 'narrow', ws: 0.8 },
    { t: 29.6, x: 458, y: 140, a: 0, sq: 0.1, vib: 0.4, e: 'o' },
    { t: 30.98, x: 396, y: 122, a: 0.12, sq: 0.06, vib: 0.7 },
    { t: 31.0, x: 392, y: 122, a: 0.3, sq: -0.15, vib: 0, e: 'l' },
    { t: 31.95, x: 340, y: 132, a: 0.42, sq: 0, arm: 0.2, e: 'i' },
    { t: 32.0, x: 336, y: 134, a: 0.3, sq: 0.2, eyes: 'wide', e: 'l' },
    { t: 32.6, x: 340, y: 134, a: 0.2, vib: 0.8, sq: 0.1 },
    { t: 33.5, x: 346, y: 132, a: -0.2, vib: 1.3, sq: 0.2 },                                    // heaving to free it
    { t: 34.0, x: 334, y: 130, a: 0.1, vib: 0.4 },
  ]);
  const XHS = [[29.4, 0.134], [31.0, 0.134], [32.0, 0.167]];
  // where each blade points: at the crossing, until it snaps; then the black blade hunts the hero
  const crossPt = (t) => [CX - 30 * eio(clip01(29.6, 30.98, t)) + z5Sh(t, 2) * 1.2, CY + 10 * clip01(29.6, 30.98, t) + z5Sh(t, 4) * 0.8];
  /* ---------------------------------------------------------------- the cameras */
  function xView(t) {
    const kk = kick(t, [[29.4, 3.4, 0], [31.0, 2.8, PI + 0.4], [32.0, 2.6, PI], [33.25, 1.4, -PI / 2]]);
    let V;
    if (t < 29.95) { const u = eio(clip01(29.6, 29.95, t)); V = { x: lerp(240, CX - 6, u), y: lerp(108, CY + 30, u * u), z: lerp(0.62, 1.0, u * u) }; }
    else if (t < 30.45) { const u = clip01(29.95, 30.45, t); const c = crossPt(t); V = { x: c[0], y: c[1] + 4, z: lerp(2.6, 4.2, eio(u)) }; }
    else if (t < 31.0) { const u = clip01(30.45, 31.0, t); V = { x: 126 - 6 * u, y: 84 + 3 * u, z: lerp(1.28, 1.38, u) }; }
    else if (t < 31.95) { const u = eio(clip01(31.05, 31.9, t)); V = { x: lerp(150, 110, u), y: lerp(96, 136, u), z: lerp(1.25, 1.55, u) }; }
    else if (t < 32.45) { const u = eio(clip01(32.05, 32.45, t)); V = { x: lerp(54, 70, u), y: lerp(138, 140, u), z: lerp(3.1, 2.5, u) }; }
    else if (t < 33.0) { const u = eio(clip01(32.45, 33.0, t)); V = { x: lerp(130, 150, u), y: lerp(136, 146, u), z: lerp(1.2, 1.0, u) }; }
    else { const u = eio(clip01(33.0, 33.9, t)); V = { x: lerp(150, 140, u), y: lerp(146, 150, u), z: lerp(1.0, 1.08, u) }; }
    V.x -= kk[2] / V.z; V.y -= kk[3] / V.z; V.z *= 1 + kk[0] * 0.6; V.r = kk[1];
    return V;
  }
  // where a fighter's sword hand is, from its pose alone (so the world can bend toward it before anyone is drawn)
  function d6HandPt(p, V) {
    const sq = p.sq || 0, bw = Math.round(26 * (1 + sq * 0.5) / 2) * 2, bh = Math.max(10, Math.round(16 * (1 - sq * 0.4))), y0 = -Math.round(bh / 2), ah = Math.max(3, Math.round(bh * 0.32)), shY = y0 + Math.round(bh * 0.34) + ah / 2 - 0.5;
    const armA = p.arm !== undefined ? p.arm : clamp((p.sw || 0) * 0.45, -1.1, 0.9), r = 3 + Math.round(p.reach || 0);
    return h5Loc(p, vX(V, p.x), vY(V, p.y), (p.S || 2) * V.z, bw / 2 - 1 + Math.cos(armA) * r, shY + Math.sin(armA) * r + 0.5);
  }
  // the horizon of this world, on screen
  const HZW = 214;
  /* ---------------------------------------------------------------- the burst of sky, the blade's pieces */
  const BUR = []; for (let k = 0; k < 34; k++) BUR.push({ a: ih(k, 1, 9601) * TAU, r: 30 + ih(k, 2, 9601) * 160, v: 140 + ih(k, 3, 9601) * 320, s: 6 + ih(k, 4, 9601) * 16, view: ['dawn', 'city', 'ink', 'ocean', 'cath', 'night'][k % 6], sp: (ih(k, 5, 9601) - 0.5) * 6 });
  function xBurst(t, V, near) {
    const g = t - 29.4 - 0.134; if (g < -0.134 || g > 2.2) return;
    const gg = Math.max(0, g), cx = vX(V, CX), cy = vY(V, CY);
    for (let k = 0; k < BUR.length; k++) {
      const B = BUR[k]; if ((k % 3 === 0) !== !!near) continue;
      const d = (B.r + B.v * (1 - Math.exp(-gg * 1.6)) / 1.6 * 1.8) * V.z, x = cx + Math.cos(B.a) * d * 1.25, y = cy + Math.sin(B.a) * d * 0.8 + 30 * gg * gg * V.z, s = B.s * V.z * (near ? 1 + gg * 1.4 : 1) * (1 - clip01(1.6, 2.2, gg));
      if (s < 1 || x < -60 || x > W + 60 || y < LB - 60 || y > H - LB + 60) continue;
      h5Shard(shardPts(x, y, s * 1.5, s, gg * B.sp + B.a, fl(B.r), 6), B.view, 160 + B.r, 110 + (k % 4) * 20, t, { seed: k, glint: k % 4 === 0, th: near ? 3 : 0 });
    }
  }
  // the pieces of the snapped blade: half white, half black, tumbling at the lens
  const SNP = []; for (let k = 0; k < 16; k++) SNP.push({ a: -0.45 + (ih(k, 1, 9640) - 0.5) * 2.2, v: 120 + ih(k, 2, 9640) * 380, s: 5 + ih(k, 3, 9640) * 6, w: (ih(k, 4, 9640) - 0.5) * 16, grow: ih(k, 5, 9640) < 0.4, f: ih(k, 6, 9640) });
  function xShards(t, V, sx, sy, ba) {
    const g = t < 31.0 ? -1 : t < 31.134 ? 0.004 : t - 31.134; if (g < 0 || g > 1.15) return;
    const slow = t > 31.25 ? 0.75 : 1;
    for (const B of SNP) {
      if (g > 0.55 + B.f * 0.35) continue;
      const gg = g < 0.12 ? g : 0.12 + (g - 0.12) * slow, d = 8 + B.v * gg * (1 + gg), x = sx + Math.cos(B.a) * d * V.z + Math.cos(ba) * (B.f - 0.5) * 40 * V.z, y = sy + Math.sin(B.a) * d * V.z + Math.sin(ba) * (B.f - 0.5) * 40 * V.z + 60 * gg * gg, s = B.s * V.z * (B.grow ? 1 + gg * 2.2 : 1);
      const rot = ba + gg * B.w * 1.8, c = Math.cos(rot), sn = Math.sin(rot), L = s * 2.4, w = s * 0.8;
      const pts = [[-L, -w], [L * 0.7, -w * 1.1], [L, w * 0.2], [-L * 0.8, w]].map(([px, py]) => [x + px * c - py * sn, y + px * sn + py * c]);
      polyF(pts, (X, Y) => { const lx = (X - x) * -sn + (Y - y) * c; return lx < -w * 0.1 ? (bay(X, Y) < 0.5 ? 140 : 141) : lx < w * 0.1 ? 22 : (bay(X, Y) < 0.1 ? 57 : bay(X, Y) < 0.5 ? 139 : 4); });
      for (let i = 0; i < 4; i++) lineP(pts[i][0], pts[i][1], pts[(i + 1) % 4][0], pts[(i + 1) % 4][1], i < 2 ? 22 : 57);
      if (g > 0.1) light(x, y, 14 * V.z, L_GOLD, 0.3);
    }
  }
  /* ---------------------------------------------------------------- 29.4–34.0 */
  function xScene(t) {
    const V = xView(t);
    const tt = d6Stop(t, XHS), frz = d6Held(t, XHS) ? 1.6 : 0;
    H5PX = V.x * 0.3; H5PY = V.y * 0.1;
    const take = t >= 33.28, peel = clip01(33.28, 33.62, t);
    const bendT = t >= 33.0 && t < 33.62;
    d6World(t, V, { sunX: 240, hz: HZW, noLine: t >= 33.0, burn: t < 33.3 ? 1 : lerp(1, 0.35, peel), dim: t > 31.05 && t < 31.95 ? 0.18 : 0 });
    xBurst(t, V, false);
    const ph = h5Pose(xH, tt), pe = h5Pose(xE, tt);
    // FURTHER: the sword hand reaches down; the line lifts into it; the world bends toward it
    let hand1 = null;
    if (t >= 33.0) {
      const g = t - 33.0, hy = D5.hy;
      hand1 = d6HandPt(ph, V);
      if (!take) {
        const pull = eoc(clip01(0.06, 0.26, g)) * Math.max(0, hy - hand1[1]), wid = 40 + 150 * eoc(clip01(0.06, 0.28, g));
        warp(hand1[0], hand1[1] + 20, 320, 0.75 * eoc(clip01(0.04, 0.28, g)), 1.1);
        d6Horizon(t, hy, 1.2, 0, W, (x) => pull * Math.exp(-Math.pow((x - hand1[0]) / wid, 2)), V.x);
        light(hand1[0], hand1[1], 90, L_GOLD, 0.7 * clip01(0.1, 0.3, g));
      } else {
        warp(hand1[0], hand1[1] + 20, 320, 0.75 * (1 - peel), 1.1);
      }
    }
    const E = d6Hol(xE, tt, V, { frz });
    if (E) h5Ash(xE, tt, V, 22, 30, -30, [0, 78, 20, 0, 22, 77]);
    const HP = d6Hero(xH, tt, V, { frz, motes: 16 });
    const cp = crossPt(t), cx = vX(V, cp[0]), cy = vY(V, cp[1]);
    const eh = E.hand, hh = HP.hand;
    if (t < 31.0) {
      // the two blades, the length of the world, crossed
      const ha = Math.atan2(cy - hh[1], cx - hh[0]), ea = Math.atan2(cy - eh[1], cx - eh[0]), crk = clip01(29.7, 30.98, t);
      const bw = Math.max(4, 6 * V.z);
      bigBlade(eh[0], eh[1], ea, 2000, bw, t, { form: 'void', flare: 0.6 });
      bigBlade(hh[0], hh[1], ha, 2000, bw, t, { form: 'dawn', flare: 0.6, cracks: crk * 2.4 });
      // cracks running back down the hero's blade from the crossing
      for (let k = 0; k < 8 * crk; k++) { const f = 1 - (k + 1) / 9 * crk, px = lerp(hh[0], cx, f), py = lerp(hh[1], cy, f); let x = px, y = py; for (let q = 0; q < 3; q++) { const nx = x + (ih(k, q, 9602) - 0.5) * 4 * V.z, ny = y + (ih(k, q, 9603) - 0.5) * 4 * V.z; lineP(x, y, nx, ny, 0); x = nx; y = ny; } if (fl(t * 20 + k) % 4 === 0) P(px, py - 2, 22); }
      // the crossing: light and dark grinding
      for (let k = 0; k < 60; k++) { const u = frac(ih(k, 1, 9604) + t * (2 + ih(k, 2, 9604) * 2.4)), sd = k & 1 ? 1 : -1, a = -PI / 2 + sd * (0.2 + ih(k, 3, 9604) * 1.3), v = (40 + ih(k, 4, 9604) * 160) * Math.min(2.2, V.z), px = cx + Math.cos(a) * v * u, py = cy + Math.sin(a) * v * u + 80 * u * u; if (bay(fl(px), fl(py)) < 1.1 - u) lineP(px, py, px - Math.cos(a) * 3 * Math.min(3, V.z), py - Math.sin(a) * 3 * Math.min(3, V.z) + 2, k % 3 === 0 ? 22 : sd > 0 ? 74 : 141); }
      sparkle(cx, cy, (6 + 4 * Math.sin(t * 40)) * Math.min(2.5, V.z), 22, 140); light(cx, cy, (70 + 12 * Math.sin(t * 31)) * Math.min(2.5, V.z), L_WH, 0.6); shk(1.2 + (t > 29.95 ? 1.2 : 0));
      // 29.4: the clash itself
      d6Hit(cx, cy, t, 29.4, 0.134, 3, undefined, [22, 140, 74], 9605, 2, [22, 140, 141, 74, 56, 57], L_GOLD);
      { const g = t - 29.4 - 0.1; if (g > 0 && g < 1.4) { for (let k = 0; k < 3; k++) { const gk = g - k * 0.14; if (gk > 0 && gk < 1) shockRing(cx, cy, 10 + gk * 700 * V.z, 4 + gk * 180 * V.z, 3 - k, [22, k ? 141 : 140, k ? 110 : 56], 1 - gk); } } }
      // the rings of the world shiver at the clash: the horizon flattened by the shockwave
      if (t > 29.5 && t < 30.2) { const g = t - 29.5, hy = D5.hy; for (let x = 0; x < W; x++) { const d = Math.abs(x - cx) - g * 700; if (Math.abs(d) < 10) { P(x, hy - 1 - (10 - Math.abs(d)) * 0.6, 22); P(x, hy - 2 - (10 - Math.abs(d)) * 0.6, 141); } } }
    } else {
      // the snap: the hero's blade is a stump; the black blade comes on, slowly, then fast, and is caught
      const g = t - 31.0, s0 = 0.42, ha0 = Math.atan2(vY(V, CY + 4) - hh[1], vX(V, CX - 28) - hh[0]);
      const sx = hh[0] + Math.cos(ha0) * 150 * V.z * s0, sy = hh[1] + Math.sin(ha0) * 150 * V.z * s0;
      if (g < 0.134) { bigBlade(hh[0], hh[1], ha0, 150 * V.z * s0, 6 * V.z, t, { form: 'dawn', flare: 0.6, cracks: 3 }); bigBlade(sx + Math.cos(ha0) * 3, sy + Math.sin(ha0) * 3, ha0 + 0.05, 600, 6 * V.z, t, { form: 'dawn', flare: 0.4, cracks: 4, noHilt: true }); }
      if (t < 31.4) { const u = clip01(31.0, 31.4, t); for (let k = 0; k < 7; k++) { const a = ha0 + PI / 2 + (k - 3) * 0.5, L = (30 + 60 * u) * V.z; lineF(sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L, (X, Y, f) => { if (bay(X, Y) < 1 - f - u * 0.6) P(X, Y, 22); }); } }
      xShards(t, V, sx, sy, ha0);
      d6Hit(sx, sy, t, 31.0, 0.134, 3, ha0 + PI, [22, 140, 141], 9608, 1, [22, 140, 141, 56, 57, 138, 74], L_GOLD);
      // the black blade
      const cg = t - 32.0, grab = HP.p.arm2 ? h5Loc(HP.p, HP.x, HP.y, HP.S, -12 + Math.cos(HP.p.arm2[0]) * (HP.p.arm2[1] + 1), -2.6 + Math.sin(HP.p.arm2[0]) * (HP.p.arm2[1] + 1)) : [hh[0], hh[1]];
      const tipT = clip01(31.0, 32.0, t), tip = cg >= 0 ? [grab[0] - 14 * V.z, grab[1] + 3 * V.z] : [vX(V, lerp(CX + 60, 20, Math.pow(tipT, 2.4))), vY(V, lerp(CY + 30, 150, Math.pow(tipT, 2.4)))];
      const ea = Math.atan2(tip[1] - eh[1], tip[0] - eh[0]) + (cg >= 0 && t < 33.9 ? z5Sh(t, 6) * 0.004 : 0), el = Math.hypot(tip[0] - eh[0], tip[1] - eh[1]), cr = cg >= 0 ? clip01(0, 1.6, cg) * 2.4 : 0;
      if (t < 34.0) bigBlade(eh[0], eh[1], ea, el, 6 * V.z, t, { form: 'void', flare: 0.6, cracks: cr });
      if (cg >= 0 && t < 34.0) {
        for (let k = 0; k < 10; k++) { let d = 6, x = grab[0], y = grab[1]; const reach = clip01(0.05, 1.8, cg) * (110 + k * 26) * V.z; while (d < reach) { const st = 7 + ih(k, fl(d), 9610) * 9, off = (ih(k, fl(d) + 3, 9611) - 0.5) * 8 * V.z; const bx = grab[0] + Math.cos(ea + PI) * -(d + st) + Math.sin(ea) * off, by = grab[1] + Math.sin(ea + PI) * -(d + st) - Math.cos(ea) * off; lineP(x, y, bx, by, 22); x = bx; y = by; d += st; } }
        const zz = Math.min(V.z, 3), cb = Math.exp(-cg * 1.2);
        // the bare fist, closed on the edge (drawn over the blade it holds)
        { const fs = 4.4 * HP.S, fa = (HP.p.arm2 ? HP.p.arm2[0] : 0) + HP.p.ang, c = Math.cos(fa), s = Math.sin(fa), fx = grab[0] - c * fs * 0.2, fy = grab[1] - s * fs * 0.2;
          const q = [[-fs, -fs * 0.9], [fs * 0.8, -fs], [fs, fs * 0.9], [-fs * 0.9, fs]].map(([px, py]) => [fx + px * c - py * s, fy + px * s + py * c]);
          polyF(q, (X, Y) => { const lx = (X - fx) * c + (Y - fy) * s, ly = -(X - fx) * s + (Y - fy) * c; if (ih(X, Y, 9652) < 0.02) return 57; return ly < -fs * 0.7 ? 56 : lx > fs * 0.7 ? 141 : lx > fs * 0.45 && Math.abs(((ly + fs) % (fs * 0.66)) - fs * 0.33) > fs * 0.27 ? 138 : bay(X, Y) < 0.2 ? 5 : 4; });
          for (let i = 0; i < 4; i++) { lineP(q[i][0], q[i][1], q[(i + 1) % 4][0], q[(i + 1) % 4][1], i === 0 ? 22 : i === 1 ? 141 : 57); }
          for (let k = 0; k < 4; k++) { const px = fx + (ih(k, 1, 9659) - 0.5) * fs * 1.4, py = fy + (ih(k, 2, 9659) - 0.5) * fs * 1.4, a = ih(k, 3, 9659) * TAU, L = fs * (0.3 + 0.4 * clip01(0, 0.6, cg)); lineP(px, py, px + Math.cos(a) * L, py + Math.sin(a) * L, 22); } }
        for (let k = 0; k < 70; k++) { const sd = k & 1 ? 1 : -1, a = ea + (sd > 0 ? PI : 0) + (ih(k, 1, 9612) - 0.5) * 1.3 + sd * 0.25, f = frac(ih(k, 2, 9612) + t * (1.6 + ih(k, 3, 9612))), v = (20 + ih(k, 4, 9612) * 70) * zz * f, px = grab[0] + Math.cos(a) * v, py = grab[1] + Math.sin(a) * v + 30 * zz * f * f; if (bay(fl(px), fl(py)) < (1.1 - f) * (0.4 + 0.6 * cb)) lineP(px, py, px - Math.cos(a) * 2 * zz, py - Math.sin(a) * 2 * zz + 1, k % 3 === 0 ? 22 : k % 3 === 1 ? 141 : 74); }
        light(grab[0], grab[1], 40 * zz, L_GOLD, 0.5 + 0.3 * cb); light(grab[0] + 30 * zz, grab[1] - 10 * zz, 30 * zz, L_MAG, 0.3);
        d6Hit(grab[0], grab[1], t, 32.0, 0.167, 2.6, ea + PI, [22, 141, 74], 9658, 1, [22, 141, 140, 57, 74, 75, 139], L_GOLD);
        if (cg < 0.6) { const u = cg / 0.6; shockRing(grab[0], grab[1], 10 + u * 140 * zz, 10 + u * 100 * zz, 4, [22, 141, 110], 1 - u); }
      }
    }
    // FURTHER: the line of dawn, taken
    if (take && t < 34.0 && hand1) {
      const HP2 = HP.hand, ang = t < 33.62 ? lerp(0.02, -0.12, peel) : t < 33.86 ? lerp(-0.12, -0.3, eio(clip01(33.62, 33.86, t))) : lerp(-0.3, 0.22, eio(clip01(33.86, 34.0, t)));
      const wave = (1 - clip01(33.28, 33.8, t)) * 14, y0 = HP2[1];
      d6Horizon(t, y0, 1.5, 0, W, (x) => -(Math.tan(ang) * (x - HP2[0])) - Math.sin((x - HP2[0]) * 0.03 - t * 18) * wave * Math.min(1, Math.abs(x - HP2[0]) / 60), V.x);
      light(HP2[0], HP2[1], 110, L_GOLD, 0.9); sparkle(HP2[0], HP2[1], 6 + 3 * Math.sin(t * 30), 22, 140);
      for (let x = 0; x < W; x += 40) light(x, y0 - Math.tan(ang) * (x - HP2[0]), 50, L_WARM, 0.35);
      if (t < 33.5) { const g = t - 33.28; shockRing(HP2[0], HP2[1], 6 + g * 500, 4 + g * 160, 3, [22, 140, 141], 1 - g / 0.22); }
    }
    xBurst(t, V, true);
    // driving into the crossing: shards of sky streaming past the lens, the contact grinding white
    if (t >= 29.95 && t < 30.45) {
      const u = clip01(29.95, 30.45, t), cx2 = vX(V, crossPt(t)[0]), cy2 = vY(V, crossPt(t)[1]);
      for (let k = 0; k < 14; k++) { const ph = frac(ih(k, 1, 9660) + u * 1.4), a = ih(k, 2, 9660) * TAU, d = 20 + ph * ph * 420, s = (4 + ph * 40) * (0.6 + ih(k, 3, 9660) * 0.6), x = cx2 + Math.cos(a) * d * 1.3, y = cy2 + Math.sin(a) * d * 0.8; if (x < -80 || x > W + 80 || y < LB - 80 || y > H - LB + 80) continue; h5Shard(shardPts(x, y, s * 1.4, s, a + ph * 3, 120 + k, 6), ['dawn', 'city', 'ink', 'ocean', 'cath', 'night'][k % 6], 120 + k * 22, 90 + (k % 5) * 25, t, { seed: k, th: 2 + s * 0.1, glint: false }); }
      for (let k = 0; k < 6; k++) { const a = ih(k, fl(t * 30), 9661) * TAU, L = 30 + ih(k, 1, 9661) * 90; lineF(cx2, cy2, cx2 + Math.cos(a) * L, cy2 + Math.sin(a) * L, (X, Y, f) => { if (bay(X, Y) < 1 - f) P(X, Y, f < 0.3 ? 22 : k & 1 ? 141 : 74); }); }
      discF(cx2, cy2, 5 + 3 * Math.sin(t * 50), 22); light(cx2, cy2, 120, L_WH, 0.5);
    }
    if (t < 31.95) d6Fore(t, V, { amt: t < 29.95 ? 0.5 : 0 });
    if (V.r) z5Cam(1, V.r, 240, 135);
  }
  shot(29.4, 34.0, (lt, t) => { xScene(t); if (t > 31.12 && t < 31.95) { GD.sat = 0.72; GD.vig = 0.55; } });
  CAPS.push([33.0, 33.9, 'x', '', 'FURTHER!!', 58]);

  /* ---------------------------------------------------------------- 34.0–36.5: the cut, the slide, the healing */
  const YC = 140;
  const HEALT = new Float32Array(GN); { const ord = []; for (let q = 0; q < GN; q++) ord.push([Math.hypot(GSX[q] - 352, (GSY[q] - 160) * 1.4) + ih(q, 1, 9620) * 60, q]); ord.sort((a, b) => a[0] - b[0]); ord.forEach(([, q], k) => { HEALT[q] = 34.95 + k / GN * 1.35; }); }
  const EFX = 330, EFY = 136, HLAND = [236, 163];
  function vScene(t) {
    const g = t - 34.0, V = { x: 240, y: 135, z: 1 }; H5PX = 60; H5PY = 0;
    if (g < 0.1) {                                                                     // the held frame: one white line on black
      BUF.fill(0);
      for (let x = 0; x < W; x++) { const u = Math.abs(x - 250) / 250, th = Math.max(0, 2.2 - u * 1.6); for (let q = -2; q <= 2; q++) { const d = Math.abs(q); if (d <= th) P(x, YC + q, 22); else if (d <= th + 1 && bay(x, YC + q) < 0.5) P(x, YC + q, 140); } }
      GD.bloom = 0.55; GD.vig = 0; GD.thr = 0.7; return;
    }
    const sg = t - 34.1, slide = Math.round(96 * eoc(clip01(0, 1.4, sg)) + 8 * sg), gap = Math.round(11 * eoc(clip01(0, 0.45, sg)) * (1 - clip01(0.8, 1.9, sg)));
    d6World(t, V, { sunX: 300, hz: HZW, burn: 0.35 + 0.4 * clip01(34.4, 35.4, t), noLine: true });
    // the Hollow, cut through: it loses its hold on itself
    const gone = clip01(34.45, 35.4, t);
    const eK = TR([{ t: 0, x: EFX, y: EFY, S: S2, form: gone > 0.2 ? 'hollow' : 'hnova', nosw: true, arm: 0.4, a: 0.1 + 0.2 * gone, flip: true, spread: 1 - gone, wl: 0, cr: 1, chip: 1, eyeC: false, eyes: gone > 0.5 ? 'closed' : 'wide', alpha: 1 - gone * 0.96, aur: 1 - gone, glow: 1 - gone, nobob: true, ws: 0.8 }, { t: 100, x: EFX, y: EFY }]);
    if (gone < 1) { const E = h5F(eK, t, { noLight: gone > 0.6 }, V); if (E) { // the cut edges crumbling to ash
      for (let x = Math.max(0, SMB[0]); x <= Math.min(W - 1, SMB[2]); x++) for (let q = -2; q <= 2; q++) { const i = (YC + q) * W + x; if (SMASK[i] && bay(x, YC + q) < 0.8 - gone * 0.5) BUF[i] = q === 0 ? 22 : (fl(t * 20 + x) % 3 ? 74 : 75); } } }
    // everything above the line slides
    if (slide > 0) for (let y = LB; y < YC; y++) { const o = y * W, sy = Math.min(YC - 1, y + gap), os = sy * W; for (let x = W - 1; x >= 0; x--) BUF[o + x] = y >= YC - gap ? (y > YC - gap + 1 && y < YC - 1 ? (Math.abs(y - (YC - gap / 2)) < gap * 0.22 ? 22 : bay(x, y) < 0.5 ? 140 : 16) : 141) : x - slide >= 0 ? BUF[os + x - slide] : (bay(x, y) < 0.08 ? 139 : 0); }
    for (let x = 0; x < W; x++) { const a = 1 - clip01(0.3, 1.8, sg); if (bay(x, YC) < a + 0.2) { P(x, YC, 22); if (a > 0.4) P(x, YC + 1, 140); P(x, YC - gap - 1, a > 0.5 ? 22 : 141); } }
    for (let x = 0; x < W; x += 24) light(x + 12, YC - gap / 2, 30 + gap * 3, L_GOLD, 0.25 + gap * 0.03);
    if (sg < 1.4) for (let y = YC + 2; y < H - LB; y++) { const k = 0.35 * (1 - sg / 1.4) * (1 - (y - YC) / 140); if (k > 0.02) for (let x = 0; x < W; x++) tintI(y * W + x, x, y, T_DARK, k); }
    // sparks off the whole length of the cut
    if (sg < 1.2) for (let k = 0; k < 90; k++) { const x = ih(k, 1, 9623) * W, f = frac(ih(k, 2, 9623) + t * (1.2 + ih(k, 3, 9623))), up = k & 1 ? -1 : 1, y = YC + up * (2 + f * (6 + ih(k, 4, 9623) * 26)) + 30 * f * f; if (bay(fl(x), fl(y)) < (1.1 - f) * (1 - sg / 1.2)) lineP(x + f * 20, y, x + f * 20 - 3, y - up, k % 3 ? 141 : 22); }
    // the upper world tearing past: a smear along the cut while it is fast
    if (sg < 0.55) { const amt = 46 * (1 - sg / 0.55), f = fl(t * 30); TMP.set(BUF); for (let y = LB; y < YC - gap - 1; y++) { const o = y * W, k0 = amt * (0.4 + 0.6 * (1 - (YC - y) / 140)); for (let x = 0; x < W; x++) { const sx = x - fl(ih(x >> 2, y, f + 931) * k0); BUF[o + x] = TMP[o + clamp(sx, 0, W - 1)]; } } }
    light(240, YC, 320, L_GOLD, 0.32 * (1 - clip01(0, 1, sg)));
    // the sky heals, shard by shard
    if (t > 34.9) {
      H5NEW.set(BUF); const nl = LIGHTS.length; w5Dawn(t, t * 6, 180, 352, 160); H5OLD.set(BUF); BUF.set(H5NEW);
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const i = y * W + x, q = GCELL[i], h = t - HEALT[q]; if (h < 0) continue; BUF[i] = GEDGE[i] && h < 0.5 ? (h < 0.1 ? 22 : bay(x, y) < 1 - h * 2 ? 135 : H5OLD[i]) : h < 0.1 && bay(x, y) < 0.5 - h * 5 ? 140 : H5OLD[i]; }
      let heal = 0; for (let q = 0; q < GN; q++) if (t > HEALT[q]) heal++; heal /= GN;
      LIGHTS.length = nl; light(352, 160, 200, L_WARM, 0.5 * heal);
      // the last shards of the line-world tumbling away as they are replaced
      for (let q = 0; q < GN; q++) { const h = t - HEALT[q]; if (h < 0 || h > 0.7) continue; const x = GSX[q] + h * 60, y = GSY[q] - h * 30 + 160 * h * h, r = 9 * (1 - h / 0.7); if (r > 1) { const pts = shardPts(x, y, r * 1.4, r, h * 6 + q, q, 5); polyF(pts, () => 0); for (let i = 0, j = 4; i < 5; j = i++) lineP(pts[j][0], pts[j][1], pts[i][0], pts[i][1], q & 1 ? 141 : 57); } }
    }
    // the ash blows out of it
    const ex = vX(V, EFX), ey = vY(V, EFY);
    if (t > 34.15 && t < 36.4) for (let k = 0; k < 190; k++) { const b = 34.15 + ih(k, 1, 9621) * 1.4, a = t - b; if (a < 0 || a > 1.3) continue; const top = k & 1, x = ex + (top ? slide : 0) + (ih(k, 2, 9621) - 0.5) * 60 + a * (60 + ih(k, 3, 9621) * 130) + Math.sin(a * 7 + k) * 5, y = ey + (top ? -1 : 1) * ih(k, 4, 9621) * 22 - a * (10 + ih(k, 5, 9621) * 40) + 20 * a * a; if (bay(fl(x), fl(y)) > 1.2 - a) continue; const big = k % 4 === 0; rectF(x, y, big ? 2 : 1, big ? 2 : 1, k % 7 === 0 ? 72 : k % 7 === 3 ? 102 : k % 3 === 0 ? 0 : k % 3 === 1 ? 120 : 121); }
    // what is left of the mask, falling, its eye going out
    if (t > 34.5 && t < 36.45) { const f = clip01(34.5, 36.45, t), mx = ex + slide * 0.6 + 14 * Math.sin(f * 5), my = lerp(ey - 6, 196, f * f); z5MaskShard(mx, my, 0.4 * (1 - 0.4 * f), 0.4 + f * 2.2, Math.max(0, 1 - f * 1.5), [0, 0], t); if (f < 0.66) light(mx, my, 26, L_MAG, 0.5 * (1 - f * 1.5)); }
    // what is left of the rest: it shrinks, flattens, and falls back to the cloud as a shadow
    { const f = eio(clip01(34.9, 36.45, t)); if (t > 34.6) { const bx = lerp(ex, HLAND[0] - 44, f), by = lerp(ey + 12, 207, f * f), rx = lerp(15, 30, f * f) * (0.4 + 0.6 * clip01(34.6, 35.1, t)), ry = lerp(9, 4, eoc(f)); for (let y = fl(by - ry); y <= by + ry; y++) for (let x = fl(bx - rx); x <= bx + rx; x++) { const dx = (x - bx) / rx, dy = (y - by) / ry, d = dx * dx + dy * dy + (vn(x + t * 9, y, 4, 9622) - 0.5) * 0.5 * (1 - f); if (d < 1) P(x, y, d > 0.8 ? (bay(x, y) < 0.5 ? 2 : 63) : f > 0.8 ? 63 : 134); } } }
    // the hero: the stroke finished, it sinks toward the cloud, the stump of its blade in its hand
    const f = eio(clip01(34.6, 36.5, t));
    const hK = TR([{ t: 0, x: lerp(112, HLAND[0], f), y: lerp(YC + 8, HLAND[1] - 6, f) + Math.sin(t * 2) * 1.5 * f, S: 3, form: 'dawn', sw: lerp(0.0, 1.1, eoc(clip01(34.5, 35.4, t))), swl: 7, a: lerp(0.16, 0, eoc(clip01(34.3, 35.2, t))), sq: lerp(-0.2, 0, eoc(clip01(34.1, 34.8, t))), reach: lerp(4, 0, eoc(clip01(34.3, 35.0, t))), spread: 1, flap: 0.2, cr: lerp(0.8, 0.2, f) }, { t: 100, x: 0, y: 0 }]);
    hK[1].x = hK[0].x; hK[1].y = hK[0].y;
    d6Hero(hK, t, V, { motes: 14 });
    // the line of dawn, let go: it runs back down to where it belongs
    if (t < 34.9) { const u = eio(clip01(34.1, 34.9, t)); d6Horizon(t, lerp(YC, D5.hy, u), 1 - u * 0.3, 0, W, null, 0); }
  }
  shot(34.0, 36.5, (lt, t) => vScene(t));
  CAPS.push([35.4, 36.9, 's', 'HOLLOW', '...I ONLY... FOLLOWED YOU.']);

  /* ---------------------------------------------------------------- 36.5–40.0: dawn */
  shot(36.5, 40.0, (lt, t) => {
    const V = { x: 240, y: 135 + 4 * eio(clip01(36.5, 40, t)), z: 1 + 0.04 * eio(clip01(36.5, 40, t)) };
    H5PX = 68; H5PY = 0;
    w5Dawn(t, t * 6, 180, 352, 160);
    // the shadow, lying still at its feet
    const sx = vX(V, HLAND[0] - 44), sy = vY(V, 207);
    for (let y = fl(sy - 5); y <= sy + 5; y++) for (let x = fl(sx - 34); x <= sx + 34; x++) { const dx = (x - sx) / 33, dy = (y - sy) / 4.4, d = dx * dx + dy * dy; if (d < 1) P(x, y, d > 0.78 ? (bay(x, y) < 0.5 ? 2 : 63) : 63); }
    // 38.8: its eye blinks, once
    { const g = t - 38.8; if (g >= 0 && g < 0.3) { const op = g < 0.07 ? g / 0.07 : g > 0.2 ? 1 - (g - 0.2) / 0.1 : 1, ex = sx - 8, ey = sy; rectF(ex - 4, ey - (op > 0.5 ? 1 : 0), 8, op > 0.5 ? 2 : 1, 73); rectF(ex - 1, ey - (op > 0.5 ? 1 : 0), 2, op > 0.5 ? 2 : 1, 75); light(ex, ey, 26, L_MAG, 0.8 * op); } }
    // the hero touches down; Dawnbreak leaves it; the broken hilt stays in its hand
    const land = t - 36.5, fade = eio(clip01(36.75, 37.7, t)), sq = 0.3 * Math.exp(-land * 7) * Math.cos(land * 14);
    const base = { x: HLAND[0], y: HLAND[1] - 6 * Math.exp(-land * 9), S: 3, a: 0, sq, sw: 1.15 - 0.1 * Math.exp(-land * 5), swl: 7, nobob: fade > 0.5 };
    const kP = TR([Object.assign({ t: 0, form: 'plain', cr: 0.12, eyes: t > 38.95 && t < 39.5 ? 'wide' : 'normal' }, base), Object.assign({ t: 100 }, base)]);
    const kD = TR([Object.assign({ t: 0, form: 'dawn', spread: 1 - 0.7 * fade, alpha: 1 - fade, aur: 1 - fade, glow: 1 - fade, ring: 1 - fade, flap: 0.14 }, base), Object.assign({ t: 100 }, base)]);
    if (fade > 0) { h5F(kP, t, { rim: [1, -0.3, 60] }, V); }
    if (fade < 1) h5F(kD, t, fade > 0 ? { noLight: fade > 0.6 } : { rim: [1, -0.3, 22] }, V);
    if (land < 0.5) { for (let k = 0; k < 14; k++) { const a = PI + ih(k, 1, 9630) * PI, v = 30 + ih(k, 2, 9630) * 60; cloudPuff(vX(V, HLAND[0]) + Math.cos(a) * v * land * 2, vY(V, 207) - Math.abs(Math.sin(a)) * 12 * land + 4, 5 * (1 - land * 2) + 1, [18, 19, 15, 16], 9631 + k); } }
    // motes of the form drifting off into the morning
    for (let k = 0; k < 30; k++) { const b = 36.7 + ih(k, 1, 9632) * 1.2, a = t - b; if (a < 0 || a > 1.6) continue; const x = vX(V, HLAND[0]) + (ih(k, 2, 9632) - 0.5) * 80 + a * 14, y = vY(V, HLAND[1]) + (ih(k, 3, 9632) - 0.5) * 50 - a * 40; if (bay(fl(x), fl(y)) < 1 - a / 1.6) P(x, y, k & 1 ? 22 : k % 4 ? 141 : 56); }
    if (t > 39.5) GD.fade = clip01(39.5, 40.0, t) * 0.9;
  }, { post: (lt, t) => {
    if (t < 37.5) return;
    const g = t - 37.5, s1 = 'FABLE 5.5', sc = g < 0.07 ? 6 : 5, w = textWidth(s1, sc);
    text(s1, 240 - w / 2, 44 - (sc - 5) * 3, (i, j, k) => (j < 2 ? 22 : k < 4 ? (j < 5 ? 56 : 55) : (j < 5 ? 59 : 58)), sc, 0);
    if (g > 0.5) { const s2 = 'PART V · THE HOLLOW'; text(s2, 240 - textWidth(s2, 2) / 2, 92, 21, 2, 0, fl((g - 0.5) * 30)); }
  } });
  }

  /* ================================================================ captions */
  // [t0, t1, kind, speaker, text, y]; kinds: n narration (top bar), s speech (bottom bar), x shout (centre; speaker picks its ink)
  function drawCaptions(t) {
    if (t > D - 2.4) { const s4 = 'UNOFFICIAL FAN CONCEPT · NOT AFFILIATED WITH ANTHROPIC'; text(s4, 240 - textWidth(s4, 1) / 2, H - LB + 9, 19, 1); }
    for (const [t0, t1, k, who, s, sy] of CAPS) {
      if (t < t0 || t >= t1) continue;
      const nv = Math.ceil((t - t0) * 38);
      if (k === 'n') { const w = textWidth(s, 1); text(s, 240 - w / 2, 9, 20, 1, undefined, nv); }
      else if (k === 's') {
        const tag = who + ':', tw = textWidth(tag, 1), w = tw + 6 + textWidth(s, 1), x0 = 240 - w / 2, y = H - LB + 9;
        text(tag, x0, y, who === 'HOLLOW' ? 73 : who === 'SUNDERER' ? 104 : who === 'UNMAKER' ? 74 : who === 'NULL' ? 42 : 35, 1);
        text(s, x0 + tw + 6, y, 21, 1, undefined, nv);
      } else {
        const u = (t - t0) / (t1 - t0), sc0 = who === 'inv' ? 6 : s.length > 10 ? 5 : 6, sc = u < 0.1 ? sc0 + 2 : sc0, w = textWidth(s, sc), x0 = 240 - w / 2, y0 = (sy || 135) - 3.5 * sc;
        if (who === 'inv') text(s, x0, y0, (i, j) => (j < 5 ? 0 : 78), sc, 22, undefined, t * 0.4);          // the Hollow's: black letters, a white edge, cold (barely shaking)
        else if (who === 'dawn') text(s, x0, y0, (i, j, k2) => (k2 * 2 < s.length - 1 ? (j < 3 ? 22 : 56) : (j < 3 ? 22 : 59)), sc, 0, undefined, t);
        else text(s, x0, y0, (i, j) => (j < 3 ? 22 : 59), sc, 0, undefined, t);
      }
    }
  }

  /* ================================================================ frame
     Part V paints in two stages. The shot draws the picture into the indexed buffer as before (144 colours). Then the grade
     turns it into true colour: every effect that gives off light has dropped a lamp (light()), and each lamp tints the world
     and the characters round it; what is bright blooms (an additive glow, so darks stay as deep as they were drawn); a gentle
     contrast curve, a vignette, and on the heaviest blows a frame or two of colour fringing. The bars and captions go on last. */
  let SHX = 0, SHY = 0;
  const RGBF = new Float32Array(NP * 3), RGB = new Uint8Array(NP * 3), CAT = new Float32Array(NP * 2);
  const LIGHTS = [], GD0 = { bloom: 0.3, thr: 0.78, con: 0.22, sat: 1.06, vig: 0.36, ca: 0, flash: 0, fc: [1, 1, 1], fade: 0, mul: [1, 1, 1] }, GD = Object.assign({}, GD0);
  function light(x, y, r, col, a) { if (a > 0.004 && r > 1) LIGHTS.push([x, y, r, col[0], col[1], col[2], a]); }
  function render(t) {
    t = clamp(t, 0, D - 1 / 30);
    T_NOW = t; SHAKE_A = 0; FRZ = 0; BUF.fill(0); LIGHTS.length = 0; Object.assign(GD, GD0); GD.fc = [1, 1, 1]; GD.mul = [1, 1, 1];
    let S = SHOTS[0];
    for (const s of SHOTS) if (t >= s.t0) S = s;
    lifeTick(t, S); SLIFE.n = 0;
    S.fn(t - S.t0, t);
    for (const [wt, dir] of WHIPS) { const d = Math.abs(t - wt); if (d < 0.1) whip(80 * (1 - d / 0.1), dir); }
    for (const c of FLASH_CUTS) if (t >= c && t < c + 0.067) GD.flash = Math.max(GD.flash, 0.5);
    grade(t);
    // the bars, the captions and whatever the shot lays over the finished picture
    BUF.fill(255); letterbox(LB);
    if (S.post) S.post(t - S.t0, t);
    drawCaptions(t);
    for (let i = 0, j = 0; i < NP; i++, j += 3) { const c = BUF[i]; if (c !== 255) { const p = PAL[c]; RGB[j] = p[0]; RGB[j + 1] = p[1]; RGB[j + 2] = p[2]; } }
    SHX = 0; SHY = 0;
  }
  const GC = 4, GW = W / GC, GH = Math.ceil(H / GC), GR = new Float32Array(GW * GH), GG = new Float32Array(GW * GH), GB2 = new Float32Array(GW * GH), GT = new Float32Array(GW * GH);
  const VIG = new Float32Array(NP);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2 - LB), r = Math.sqrt(dx * dx * 0.8 + dy * dy * 0.6); VIG[y * W + x] = sstep(0.55, 1.25, r); }
  function blur(A) {
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < GH; y++) { let acc = 0; const row = y * GW; for (let x = -3; x < GW + 3; x++) { if (x + 3 < GW) acc += A[row + x + 3]; if (x - 4 >= 0) acc -= A[row + x - 4]; if (x >= 0 && x < GW) GT[row + x] = acc / 7; } }
      for (let x = 0; x < GW; x++) { let acc = 0; for (let y = -3; y < GH + 3; y++) { if (y + 3 < GH) acc += GT[(y + 3) * GW + x]; if (y - 4 >= 0) acc -= GT[(y - 4) * GW + x]; if (y >= 0 && y < GH) A[y * GW + x] = acc / 7; } }
    }
  }
  function grade(t) {
    // the shake is a camera being knocked about: smooth noise, and only the picture moves
    const f = fl(t * 30), nz = (k) => Math.sin(t * 37.1 + k) * 0.55 + Math.sin(t * 59.3 + k * 2.3) * 0.3 + (ih(f, k, 901) - 0.5) * 0.3;
    const sdx = Math.round(nz(1) * 1.6 * SHAKE_A), sdy = Math.round(nz(2) * 1.6 * SHAKE_A);
    for (let y = 0; y < H; y++) { const sy = y < LB || y >= H - LB ? y : clamp(y - sdy, LB, H - LB - 1); for (let x = 0; x < W; x++) { const p = PAL[BUF[sy * W + clamp(x - sdx, 0, W - 1)]], j = (y * W + x) * 3; RGBF[j] = p[0]; RGBF[j + 1] = p[1]; RGBF[j + 2] = p[2]; } }
    // lamps
    for (const [lx0, ly0, r, cr, cg, cb, a] of LIGHTS) {
      const lx = lx0 + sdx, ly = ly0 + sdy, x0 = Math.max(0, fl(lx - r)), x1 = Math.min(W - 1, Math.ceil(lx + r)), y0 = Math.max(LB, fl(ly - r)), y1 = Math.min(H - LB - 1, Math.ceil(ly + r)), ir = 1 / r;
      for (let y = y0; y <= y1; y++) { const dy = (y + 0.5 - ly) * ir; for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - lx) * ir, d = dx * dx + dy * dy; if (d >= 1) continue;
        const fo = 1 - Math.sqrt(d), k = a * fo * fo, j = (y * W + x) * 3;
        if (cr < 0) { const m = 1 - Math.min(0.95, k); RGBF[j] *= m; RGBF[j + 1] *= m; RGBF[j + 2] *= m; }
        else { RGBF[j] = RGBF[j] * (1 + k * cr * 0.9) + 42 * cr * k; RGBF[j + 1] = RGBF[j + 1] * (1 + k * cg * 0.9) + 42 * cg * k; RGBF[j + 2] = RGBF[j + 2] * (1 + k * cb * 0.9) + 42 * cb * k; }
      } }
    }
    // bloom
    if (GD.bloom > 0.01) {
      GR.fill(0); GG.fill(0); GB2.fill(0);
      const thr = GD.thr * 255, inv = 1 / ((255 - thr) * GC * GC);
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
        const j = (y * W + x) * 3, r = RGBF[j], g = RGBF[j + 1], b = RGBF[j + 2], l = r * 0.3 + g * 0.55 + b * 0.15; if (l < thr) continue;
        const k = Math.min(1, (l - thr) * inv * GC * GC) / (GC * GC), q = fl(y / GC) * GW + fl(x / GC);
        GR[q] += Math.min(255, r) * k; GG[q] += Math.min(255, g) * k; GB2[q] += Math.min(255, b) * k;
      }
      blur(GR); blur(GG); blur(GB2);
      const bl = GD.bloom;
      for (let y = LB; y < H - LB; y++) {
        const gy = clamp((y - GC / 2) / GC, 0, GH - 1.001), y0 = fl(gy), fy = gy - y0;
        for (let x = 0; x < W; x++) {
          const gx = clamp((x - GC / 2) / GC, 0, GW - 1.001), x0 = fl(gx), fx = gx - x0, q = y0 * GW + x0, j = (y * W + x) * 3;
          const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
          RGBF[j] += (GR[q] * w00 + GR[q + 1] * w10 + GR[q + GW] * w01 + GR[q + GW + 1] * w11) * bl;
          RGBF[j + 1] += (GG[q] * w00 + GG[q + 1] * w10 + GG[q + GW] * w01 + GG[q + GW + 1] * w11) * bl;
          RGBF[j + 2] += (GB2[q] * w00 + GB2[q + 1] * w10 + GB2[q + GW] * w01 + GB2[q + GW + 1] * w11) * bl;
        }
      }
    }
    // colour fringing on a heavy blow: red and blue pulled apart, more toward the edges
    const ca = GD.ca;
    if (ca > 0.3) {
      for (let i = 0; i < NP; i++) { CAT[i * 2] = RGBF[i * 3]; CAT[i * 2 + 1] = RGBF[i * 3 + 2]; }
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const sh = Math.round(ca * (x - W / 2) / (W / 2)), sv = Math.round(ca * 0.5 * (y - H / 2) / (H / 2)); if (!sh && !sv) continue; const xa = clamp(x - sh, 0, W - 1), xb = clamp(x + sh, 0, W - 1), ya = clamp(y - sv, LB, H - LB - 1), yb = clamp(y + sv, LB, H - LB - 1), j = (y * W + x) * 3; RGBF[j] = RGBF[j] * 0.45 + CAT[(ya * W + xa) * 2] * 0.55; RGBF[j + 2] = RGBF[j + 2] * 0.45 + CAT[(yb * W + xb) * 2 + 1] * 0.55; }
    }
    // curve, saturation, flash, fade, vignette
    const con = GD.con, sat = GD.sat, fl_ = Math.min(0.9, GD.flash), fc = GD.fc, fade = 1 - clamp(GD.fade, 0, 1), mul = GD.mul, vg = GD.vig;
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, j = i * 3;
      let r = Math.min(1, RGBF[j] / 255) * mul[0], g = Math.min(1, RGBF[j + 1] / 255) * mul[1], b = Math.min(1, RGBF[j + 2] / 255) * mul[2];
      const l = r * 0.3 + g * 0.55 + b * 0.15;
      r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
      r = r < 0 ? 0 : r > 1 ? 1 : r; g = g < 0 ? 0 : g > 1 ? 1 : g; b = b < 0 ? 0 : b > 1 ? 1 : b;
      r += (r * r * (3 - 2 * r) - r) * con; g += (g * g * (3 - 2 * g) - g) * con; b += (b * b * (3 - 2 * b) - b) * con;
      if (fl_ > 0) { r += (fc[0] - r) * fl_; g += (fc[1] - g) * fl_; b += (fc[2] - b) * fl_; }
      const v = (1 - VIG[i] * vg) * fade;
      RGB[j] = r * v * 255 + 0.5; RGB[j + 1] = g * v * 255 + 0.5; RGB[j + 2] = b * v * 255 + 0.5;
    }
  }

  /* ================================================================ present */
  let SMALL = null, SG = null, IMG = null;
  function drawFrame(t, g, cw, ch, k, ox, oy) {
    render(t);
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H);
    }
    const d = IMG.data;
    for (let i = 0, j = 0, q = 0; i < NP; i++, j += 3, q += 4) { d[q] = RGB[j]; d[q + 1] = RGB[j + 1]; d[q + 2] = RGB[j + 2]; d[q + 3] = 255; }
    SG.putImageData(IMG, 0, 0);
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#04050b'; g.fillRect(0, 0, cw, ch);
    g.drawImage(SMALL, ox, oy, W * k, H * k);
  }

  /* ================================================================ mount */
  if (typeof window !== 'undefined') window.__hollow_core = { render, BUF, RGB, PAL, W, H, D, SHOTS, CAPS };
  (window.PIECES = window.PIECES || []).push({
    id: 'the-hollow',
    title: 'The Hollow',
    medium: 'Pixel art, 480 × 270, drawn in JavaScript · 40 s',
    note: 'Fable Saga, part V · tap to pause',
    about: 'Part five of the Fable saga. The ash of both brothers pours into the hero\'s own shadow, and the shadow stands up: the Hollow, its exact size and speed, with a cracked half-mask and one eye from each of them. A forty-second duel, blade on blade, falling and climbing through the worlds behind a sky of glass, to a new form, Dawnbreak, and a cut along the horizon itself. Drawn frame by frame in JavaScript into a 480 × 270 indexed buffer, then lit and graded in true colour. An unofficial fan concept, not affiliated with Anthropic.',
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
        window.__thehollow = {
          duration: D,
          isReady: () => ready && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__thehollow.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-hollow';
        api.ready();
      } else {
        window.__thehollow = { duration: D, isReady: () => ready, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
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
          if (window.__thehollow) delete window.__thehollow;
        },
      };
    },
  });

})();
