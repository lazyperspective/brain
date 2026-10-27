/* The Null — Fable Saga, part II.
 *
 * A 42-second pixel-art action short: the coral hero from Fable Quest meets its shadow, a glitched
 * double called the Null, and the fight goes up, through and above the clouds. Every frame is a pure
 * function of t, drawn into a 480 × 270 indexed buffer in 64 colours and shown at 4×. The film is cut
 * as a sequence of shots, each with its own camera, composed in screen space; a letterbox, captions
 * and shouts sit on top. An unofficial fan concept, not affiliated with Anthropic.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 480, H = 270, NP = W * H, D = 42;
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
  function buildSprite(o) {
    SPR.fill(0); SPK.fill(0); LBB[0] = 1e9; LBB[1] = 1e9; LBB[2] = -1e9; LBB[3] = -1e9;
    const sq = o.sq || 0, bw = Math.round(26 * (1 + sq * 0.5) / 2) * 2, bh = Math.max(10, Math.round(16 * (1 - sq * 0.4)));
    const x0 = -bw / 2, y0 = -Math.round(bh / 2), y1 = y0 + bh;
    const N = o.who === 'null';
    const body = N ? 40 : CORAL, dark = N ? 39 : CORD, lite = N ? 41 : CORL;
    // legs
    const lift = o.legs || [0, 0, 0, 0], lh = o.fly ? 4 : 6;
    const lx = [x0, x0 + Math.round(bw * 0.2), x0 + bw - Math.round(bw * 0.2) - 4, x0 + bw - 4];
    for (let k = 0; k < 4; k++) spRect(lx[k], y1, 4, Math.max(1, lh - lift[k]), k === 0 || k === 2 ? body : body, 1);
    // body with a little shading (flat, as in the reference, just a lit top edge and a darker base)
    spRect(x0, y0, bw, bh, body, 1);
    for (let i = 0; i < bw; i++) { sp(x0 + i, y1 - 1, dark, 1); if (o.shade) sp(x0 + i, y0, lite, 1); }
    // arms
    const ay = y0 + Math.round(bh * 0.34), ah = Math.max(3, Math.round(bh * 0.32));
    spRect(x0 - 4, ay, 4, ah, body, 1); spRect(x0 + bw, ay, 4, ah, body, 1);
    if (N) { // claws, and a jagged crown
      for (const s of [-1, 1]) { const ax = s < 0 ? x0 - 5 : x0 + bw + 4; sp(ax, ay, body, 1); sp(ax + s, ay - 1, 42, 1); sp(ax, ay + ah - 1, body, 1); sp(ax + s, ay + ah, 42, 1); }
      for (const [cx, h] of [[x0 + 5, 4], [0, 7], [x0 + bw - 6, 4]]) for (let j = 0; j < h; j++) { const w = Math.max(0, Math.round((h - j) * 0.45)); for (let i = -w; i <= w; i++) sp(cx + i, y0 - 1 - j, j > h - 3 ? 42 : 39, 1); }
      for (let i = 0; i < bw; i += 3) sp(x0 + i + (ih(i, 1, 41) < 0.5 ? 1 : 0), y0 + 2 + fl(ih(i, 2, 41) * (bh - 4)), 41, 1); // glitch flecks
    }
    // eyes
    const ex0 = x0 + Math.round(bw * 0.17), ex1 = x0 + bw - Math.round(bw * 0.17) - 2, ey = y0 + Math.round(bh * 0.28);
    const EC = N ? 42 : 0, e = o.eyes || 'normal';
    const eye = (ex, side) => {
      if (e === 'closed') { spRect(ex, ey + 2, 2, 1, EC, 1); return; }
      if (e === 'glow') { spRect(ex - 1, ey - 1, 4, 5, 59, 1); spRect(ex, ey, 2, 3, 22, 1); return; }
      if (e === 'wide') { spRect(ex - 1, ey - 1, 3, 4, EC, 1); sp(ex - 1, ey - 1, 22, 1); return; }
      if (e === 'narrow') { spRect(ex, ey + 1, 2, 2, EC, 1); return; }
      spRect(ex, ey, 2, 3, EC, 1);
      if (e === 'angry' || N) { const inner = side < 0 ? ex + 1 : ex; sp(inner + side * -1, ey - 1, N ? 42 : 0, 1); sp(inner + side * -1 + (side < 0 ? 1 : -1), ey - 2, N ? 42 : 0, 1); sp(ex + (side < 0 ? 0 : 1), ey, body, 1); }
    };
    eye(ex0, -1); eye(ex1, 1);
    if (o.mouth) { const mw = o.mouth > 1 ? 8 : 4, mh = o.mouth > 1 ? 4 : 2; spRect(-mw / 2, ey + 5, mw, mh, N ? 42 : 0, 1); if (N) for (let i = -mw / 2; i < mw / 2; i += 2) sp(i, ey + 5, 39, 1); else if (o.mouth > 1) spRect(-mw / 2 + 1, ey + 5 + mh - 1, mw - 2, 1, 36, 1); }
    // sword on the right arm nub
    if (o.sword !== undefined && o.sword !== null) spSword(x0 + bw + 2, ay + ah / 2 - 0.5, o.sword, o.swordCols || null);
    // outline
    const oc = o.outline !== undefined ? o.outline : N ? 42 : 22;
    const src = SPR.slice();
    for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
      const i = y * SW + x; if (src[i]) continue;
      if (src[i - 1] || src[i + 1] || src[i - SW] || src[i + SW]) { SPR[i] = (SPK[i - 1] === 2 || SPK[i + 1] === 2 || SPK[i - SW] === 2 || SPK[i + SW] === 2 ? (N ? 42 : 1) : oc) + 1; SPK[i] = 4; }
    }
    LBB[0]--; LBB[1]--; LBB[2]++; LBB[3]++;
    return { bw, bh, hand: [x0 + bw + 2, ay + ah / 2], top: y0, bottom: y1 + lh };
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
    if (o.who === 'null' && !opt.clean) glitchRows(T_NOW, Math.max(2, Math.round(S * 1.5)));
    const c = Math.cos(ang), s = Math.sin(ang), hx = (flip ? -1 : 1) * g.hand[0] * S, hy = g.hand[1] * S;
    const hand = [x + hx * c - hy * s, y + hx * s + hy * c];
    const sw = o.sword !== undefined && o.sword !== null ? o.sword : 0, da = flip ? PI - sw : sw, tipL = 29 * S;
    const tip = [hand[0] + Math.cos(da + ang) * tipL, hand[1] + Math.sin(da + ang) * tipL];
    return { hand, tip, g };
  }
  // horizontal tears through the last stamped sprite
  const ROWT = new Uint8Array(W);
  function glitchRows(t, amp) {
    const f = fl(t * 15);
    for (let y = SMB[1]; y <= SMB[3]; y++) {
      const band = fl(y / 3), r = ih(band, f, 51);
      if (r > 0.18) continue;
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

  /* ================================================================ the film: shots */
  const LB = 26;                                           // letterbox bar height
  const SKY_DUSK = [3, 4, 5, 10, 11, 12, 13, 14, 15], SKY_RED = [1, 9, 10, 11, 12, 13], SKY_HIGH = [2, 3, 4, 5, 6, 7], SKY_DAWN = [4, 5, 6, 7, 8, 19, 15, 16];
  const CLOUD_RED = [9, 10, 11, 12], CLOUD_DUSK = [4, 17, 18, 19], CLOUD_HI = [17, 18, 20, 21], CLOUD_GOLD = [18, 19, 15, 16];
  const HERO = (o) => Object.assign({ who: 'hero' }, o), NULLO = (o) => Object.assign({ who: 'null' }, o);
  const AURA_NULL = [39, 43, 42, 44], AURA_GOLD = [58, 58, 59, 60], AURA_RAIN = (t) => EL[fl(t * 8) % 4].slice(0, 3).concat([60]);
  let SHAKE_A = 0;
  const shk = (a) => { SHAKE_A = Math.max(SHAKE_A, a); };
  // the crack in the sky the Null comes through
  function skyCrack(cx, y0, y1, open, t, scale) {
    scale = scale || 1;
    if (open <= 0) return;
    glow(cx, (y0 + y1) / 2, (y1 - y0) * 0.9 * open, T_RED, 0.55 * open);
    let px = cx;
    for (let y = y0; y <= y1; y++) {
      const u = (y - y0) / (y1 - y0), jag = (vn(y, 0, 6 * scale, 91) - 0.5) * 26 * scale + (vn(y, 0, 2, 92) - 0.5) * 6 * scale;
      const w = open * (1 - Math.abs(u - 0.5) * 1.8) * 9 * scale + 0.5;
      const x = cx + jag;
      for (let q = -fl(w) - 2; q <= fl(w) + 2; q++) P(x + q, y, Math.abs(q) <= w ? (Math.abs(q) < w - 1.5 ? 0 : 42) : 43);
      px = x;
    }
    // squares of broken sky drifting off the edges
    for (let k = 0; k < 30 * open; k++) {
      const u = frac(ih(k, 1, 93) + t * 0.25), y = lerp(y0, y1, ih(k, 2, 93)), x = cx + (vn(y, 0, 6 * scale, 91) - 0.5) * 26 * scale + (ih(k, 3, 93) < 0.5 ? -1 : 1) * (10 + u * 50) * scale;
      const s = 1 + fl(ih(k, 4, 93) * 3);
      if (bay(fl(x), fl(y)) > 1 - u) continue;
      rectF(x, y - u * 10, s, s, ih(k, 5, 93) < 0.5 ? 0 : 42);
    }
  }
  function grassField(y0, ox, cols) {
    for (let y = fl(y0); y < H; y++) for (let x = 0; x < W; x++) {
      const wx = x + ox * (1 + (y - y0) / 40), n = vn(wx, y * 3, 6, 95);
      BUF[y * W + x] = y < y0 + 2 ? cols[2] : n > 0.62 ? cols[2] : n > 0.35 ? cols[1] : cols[0];
    }
  }
  const SHOTS = [];
  const shot = (t0, t1, fn) => SHOTS.push({ t0, t1, fn });

  // 1 — the vista: a hero on a cliff at dusk; the sky cracks
  shot(0, 3.4, (lt, t) => {
    const crimson = sstep(2.2, 3.4, lt);
    gradient(0, 205, SKY_DUSK);
    stars(t, 80, 60, 101);
    glow(340, 190, 70, T_WARM, 0.5); discF(340, 192, 20, 15); discF(340, 192, 16, 16);
    const ox = lt * 5;
    ridge(200, 70, 90, 111, 4, 5, ox * 0.3);
    ridge(212, 42, 60, 112, 10, 11, ox * 0.6);
    canopy(232, 9, 113, 23, 24, ox);
    // the cliff in the foreground
    for (let x = 0; x < 170; x++) { const top = 196 + Math.pow(Math.max(0, x - 120) / 50, 2) * 50 + (vn(x, 0, 7, 114) - 0.5) * 4; for (let y = fl(top); y < H; y++) BUF[y * W + x] = y < top + 2 ? 31 : (vn(x, y, 5, 115) > 0.6 ? 29 : 28); }
    tintAll(T_CRIM, crimson * 0.45);
    skyCrack(300, 22, 150, sstep(2.3, 3.1, lt), t);
    actor(HERO({ eyes: lt > 2.6 ? 'wide' : 'normal', sword: -2.2 }), 112, 187, 1, 0, false);
    if (lt > 2.4 && lt < 3.0) shk(1.5);
  });
  // 2 — low angle: the Null descends through the crack
  shot(3.4, 6.0, (lt, t) => {
    gradient(LB, H - LB, SKY_RED);
    skyCrack(240, LB - 10, 150, 1, t, 1.6);
    // treetops pointing up from the bottom corners
    for (let x = 0; x < W; x++) { const e = Math.min(x, W - 1 - x), top = H - LB - 10 - Math.max(0, 70 - e * 0.55) - Math.abs(Math.sin(x * 0.21)) * 14; for (let y = fl(top); y < H; y++) BUF[y * W + x] = y < top + 2 ? 10 : 1; }
    const y = lerp(40, 118, eoc(lin(0, 1.8, lt)));
    actor(NULLO({ eyes: 'angry', mouth: lt > 1.2 ? 1 : 0 }), 240, y, 3, Math.sin(t * 2) * 0.04, false);
    aura(t, AURA_NULL, 14, { sparks: 24 });
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 121) + t * 0.5); rectF(240 + (ih(k, 2, 121) - 0.5) * 140, y + 40 - u * 120, 2, 2, ih(k, 3, 121) < 0.5 ? 0 : 42); }
  });
  // 3 — close on the hero: no
  shot(6.0, 7.5, (lt, t) => {
    gradient(LB, H - LB, [10, 11, 12, 11]);
    streaks(0.08, 30, t, 900, 13, 60, 131, [0, LB, W, H - 2 * LB]);
    const draw = lt > 0.7, ang = draw ? lerp(-2.6, -1.25, eob(lin(0.7, 0.95, lt))) : undefined;
    const a = actor(HERO({ eyes: lt > 0.35 ? 'angry' : 'normal', sword: draw ? ang : undefined, shade: true }), 230, 172, 7, 0, false);
    if (lt > 0.92 && lt < 1.3) { const u = (lt - 0.92) / 0.38; sparkle(lerp(a.hand[0], a.tip[0], 0.3 + u * 0.7), lerp(a.hand[1], a.tip[1], 0.3 + u * 0.7), 9 * Math.sin(PI * u), 22, 59); }
  });
  // 4 — the clash
  shot(7.5, 9.7, (lt, t) => {
    const hit = 0.85;
    gradient(LB, 196, SKY_RED);
    skyCrack(240, LB, 120, 0.7, t, 1.1);
    ridge(196, 26, 50, 141, 9, 10, 0);
    const bend = lt > hit ? Math.sin((lt - hit) * 18) * Math.exp(-(lt - hit) * 3) * 8 : 0;
    canopy(206, 8, 142, 1, 10, 0, 1.0);
    grassField(206, 0, [24, 25, 26]);
    const u = Math.pow(lin(0, hit, lt), 2);
    const hx = lt < hit ? lerp(24, 204, u) : 204 - eoc(lin(hit, hit + 0.5, lt)) * 10, nx = lt < hit ? lerp(456, 278, u) : 278 + eoc(lin(hit, hit + 0.5, lt)) * 10;
    if (lt < hit) { streaks(0, 40, t, 1600, 20, 90, 143, [0, 140, W, 60]); }
    const after = (x0, dir, c) => [0, 1, 2].map((k) => [x0 - dir * (k + 1) * 22, 176, c, 0.5 - k * 0.15]);
    actor(NULLO({ eyes: 'angry', mouth: 1 }), nx, 176, 2.4, lt < hit ? 0.25 : 0.05, true, lt < hit ? { after: after(nx, -1, 43) } : {});
    aura(t, AURA_NULL, 6, { sparks: 8 });
    const a = actor(HERO({ eyes: 'angry', sword: lt < hit ? 0.3 : -0.25 }), hx, 176, 2.4, lt < hit ? -0.25 : -0.05, false, lt < hit ? { after: after(hx, 1, 36) } : {});
    if (lt > hit) {
      const g = lt - hit;
      shockRing(242, 196, 20 + g * 420, 20 + g * 60, 3, [22, 20, 19], 1 - g * 1.2);
      debris(242, 200, g, 40, 140, 1, [29, 30, 26], 144);
      for (let k = 0; k < 14; k++) { const aa = ih(k, fl(t * 20), 145) * TAU; sparkle(242 + Math.cos(aa) * 8 * ih(k, 2, 145), 172 + Math.sin(aa) * 8, 2, 22, 59); }
      glow(242, 172, 60 * Math.exp(-g * 2), T_WH, 0.7);
      shk(4 * Math.exp(-g * 2.5));
    }
    void bend; void a;
  });
  // 5a — over the shoulder: a swing that fills the frame
  shot(9.7, 10.35, (lt, t) => {
    gradient(LB, H - LB, [10, 11, 12, 13]);
    grassField(196, t * 40, [24, 25, 26]);
    actor(NULLO({ eyes: 'angry' }), 370, 176, 1.8, 0, true);
    aura(t, AURA_NULL, 7, { sparks: 6 });
    const sw = lerp(-2.4, 0.9, eoc(lin(0.05, 0.3, lt)));
    actor(HERO({ eyes: 'angry', sword: sw, shade: true }), 120, 230, 5, 0.1, false);
    if (lt > 0.08 && lt < 0.5) {
      const fade = lin(0.3, 0.5, lt), a0 = sw - 2.2 + fade * 2.0, cx = 168, cy = 214;
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
        const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        if (a > sw || a < a0) continue;
        const u = (sw - a) / (sw - a0 + 1e-6), rin = lerp(165, 120, u), rout = 172 - u * 6; // a crescent that thins toward its tail
        if (r < rin || r > rout) continue;
        const e = (r - rin) / (rout - rin);
        BUF[y * W + x] = e > 0.8 ? 22 : u < 0.35 ? 22 : u < 0.6 ? 60 : u < 0.85 ? 59 : (bay(x, y) < 0.5 ? 58 : BUF[y * W + x]);
      }
      for (let k = 0; k < 12; k++) sparkle(350 + ih(k, 1, 151) * 20, 165 + ih(k, 2, 151) * 20, 3, 22, 59);
      shk(2);
    }
  });
  // 5b — from above: two fighters circling, trails braided
  shot(10.35, 11.0, (lt, t) => {
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const n = fbm(x + 30, y + lt * 30, 30, 3, 161); BUF[y * W + x] = n > 0.62 ? 23 : n > 0.5 ? 24 : n > 0.42 ? 25 : (vn(x, y, 3, 162) > 0.5 ? 26 : 25); }
    tintAll(T_CRIM, 0.3);
    const cx = 240, cy = 135, R = 84;
    for (let k = 0; k < 2; k++) {
      const ph = lt * 9 + k * PI;
      for (let q = 1; q <= 14; q++) { const a = ph - q * 0.07, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.75; if (bay(fl(x), fl(y)) < 1 - q / 14) { P(x, y, k ? 42 : 59); P(x + 1, y, k ? 43 : 58); } }
      const x = cx + Math.cos(ph) * R, y = cy + Math.sin(ph) * R * 0.75;
      actor(k ? NULLO({ eyes: 'angry' }) : HERO({ eyes: 'angry', sword: -0.6 }), x, y, 1.8, ph + PI / 2, false, { clean: true });
    }
    if (frac(lt * 4.5) < 0.2) { sparkle(cx, cy, 8, 22, 59); glow(cx, cy, 30, T_WH, 0.5); shk(1.5); }
  });
  // 5c — blade against claw
  shot(11.0, 11.6, (lt, t) => {
    gradient(LB, H - LB, [9, 10, 11, 10]);
    radialLines(240, 135, 60, 70, 12, t, 171);
    // a huge blade from the lower left, a crimson claw from the right, locked where they meet
    const j = Math.round(Math.sin(t * 60) * 1.5), mx = 250 + j, my = 128;
    const bx0 = -40, by0 = 330, ddx = mx + 30 - bx0, ddy = my - 18 - by0, BL = Math.hypot(ddx, ddy), ux = ddx / BL, uy = ddy / BL;
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const px = x - bx0, py = y - by0, u = px * ux + py * uy, v = -px * uy + py * ux;
      if (u < 0 || u > BL) continue;
      const hw = u > BL - 40 ? (BL - u) / 40 * 16 : 16;
      if (Math.abs(v) > hw) continue;
      BUF[y * W + x] = Math.abs(v) > hw - 2 ? 0 : v < -hw * 0.25 ? (v < -hw + 4 ? 22 : 34) : Math.abs(v) < 1.5 ? 33 : 32;
    }
    // the Null's forearm and claws
    for (let y = LB; y < H - LB; y++) for (let x = mx + 10; x < W; x++) { const yy = my + 26 + (x - mx) * 0.32; if (Math.abs(y - yy) < 26) BUF[y * W + x] = Math.abs(y - yy) > 23 ? 42 : (vn(x, y, 3, 173) > 0.72 ? 41 : 40); }
    for (let k = 0; k < 3; k++) {
      const by = my - 10 + k * 20, bx = mx + 40;
      for (let q = 0; q < 46; q++) { const ww = (1 - q / 46) * 7 + 0.5, cx = bx - q, cy = by + (q * q) / 90 - q * 0.1; for (let s = -ww; s <= ww; s++) P(cx, cy + s, Math.abs(s) > ww - 1.5 ? 42 : s < 0 ? 41 : 39); }
    }
    for (let k = 0; k < 60; k++) { const u = frac(ih(k, 1, 172) + lt * 3), a = -PI * (0.1 + ih(k, 2, 172) * 0.8); const x = mx + Math.cos(a) * u * 160, y = my + Math.sin(a) * u * 100 + u * u * 90; P(x, y, u < 0.4 ? 22 : 59); P(x + 1, y, 58); P(x - Math.cos(a) * 3, y - Math.sin(a) * 3, 58); }
    sparkle(mx, my, 14 + j * 3, 22, 59);
    glow(mx, my, 60, T_GOLD, 0.6);
    shk(2.5);
  });
  // 5d — the punch: the hero sent flying through the trees
  shot(11.6, 12.7, (lt, t) => {
    const hit = 0.15, fly = lin(hit, 1.1, lt);
    const cam = fly * 900;
    gradient(LB, H - LB, SKY_RED);
    ridge(200, 30, 60, 181, 9, 10, cam * 0.2);
    canopy(214, 8, 182, 1, 10, cam * 0.5);
    grassField(214, cam, [24, 25, 26]);
    if (lt > hit) streaks(PI, 50, t, 2200, 20, 120, 183, [0, LB, W, H - 2 * LB]);
    // trunks the hero smashes through
    for (let k = 0; k < 3; k++) {
      const tx = 420 + k * 260 - cam, broke = tx < 250;
      for (let y = LB; y < 214; y++) for (let q = -9; q <= 9; q++) { const yy = broke && y > 140 && y < 175 ? -1 : y; if (yy < 0) continue; P(tx + q + (broke && y < 140 ? (175 - y) * 0.15 : 0), y, Math.abs(q) > 7 ? 27 : 28); }
      if (broke) debris(tx, 158, (250 - tx) / 600, 18, 90, 1, [29, 30, 31], 184 + k);
    }
    const hx = lt < hit ? 200 : 250, nx = lt < hit ? 160 : 160 - fly * 400;
    actor(NULLO({ eyes: 'angry', mouth: 1 }), nx, 196, 1.6, -0.2, false);
    actor(HERO({ eyes: lt > hit ? 'closed' : 'wide', sword: -1.0 }), hx, 186, 1.6, lt > hit ? 0.5 + lt * 9 : 0, false);
    if (lt > hit && lt < hit + 0.25) { const g = (lt - hit) / 0.25; burst(212, 184, g, 120, 16, 0.4, [22, 59], 3); shockRing(212, 184, 10 + g * 140, 10 + g * 90, 3, [22, 20, 59], 1 - g); shk(5); }
    if (lt > hit && lt < hit + 0.07) impactFrame(212, 184, 1);
  });
  // 6 — the crater: the Null looks down
  shot(12.7, 15.0, (lt, t) => {
    gradient(LB, H - LB, SKY_RED);
    skyCrack(130, LB, 110, 0.6, t, 0.9);
    // a cliff face on the right with a crater punched in it
    for (let y = LB; y < H; y++) for (let x = 230; x < W; x++) { const e = x - 230 - (y - LB) * -0.2 + (vn(x, y, 9, 191) - 0.5) * 20; if (e < 0) continue; BUF[y * W + x] = vn(x, y, 6, 192) > 0.55 ? 29 : 28; }
    const cx = 360, cy = 150;
    for (let y = cy - 50; y < cy + 50; y++) for (let x = cx - 60; x < cx + 60; x++) { const dx = (x - cx) / 56, dy = (y - cy) / 42, d = dx * dx + dy * dy; if (d < 1) P(x, y, d < 0.6 ? 27 : d < 0.85 ? 28 : 30); }
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU + 0.3; let x = cx + Math.cos(a) * 52, y = cy + Math.sin(a) * 40; for (let s = 0; s < 6; s++) { const nx = x + Math.cos(a + (ih(k, s, 193) - 0.5)) * 9, ny = y + Math.sin(a + (ih(k, s, 194) - 0.5)) * 9; lineP(x, y, nx, ny, 27); x = nx; y = ny; } }
    actor(HERO({ eyes: 'closed' }), cx + 4, cy + 4, 1.6, 0.6, false);
    debris(cx, cy - 30, lt, 20, 60, 0.4, [29, 30, 31], 195, 120);
    for (let k = 0; k < 30; k++) { const u = frac(ih(k, 1, 196) + lt * 0.3); discF(cx - 40 + ih(k, 2, 196) * 80 - u * 30, cy + 40 - u * 50, 3 + u * 5, u < 0.5 ? 30 : 29); }
    const ny = 92 + Math.sin(t * 2) * 3;
    actor(NULLO({ eyes: 'angry', mouth: lt > 0.6 ? 1 : 0 }), 140, ny, 1.8, 0, false);
    aura(t, AURA_NULL, 8, { sparks: 10 });
    if (lt < 0.3) shk(4 * (1 - lt / 0.3));
  });
  // 7a — the eye opens
  shot(15.0, 16.3, (lt, t) => {
    gradient(LB, H - LB, [62, 1, 27, 28]);
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 203) + t * 0.1); discF(ih(k, 2, 203) * W, H - LB - u * 40, 6 + ih(k, 3, 203) * 10, 27); }
    actor(HERO({ eyes: lt < 0.55 ? 'closed' : 'angry', shade: true }), 240, 236, 10, 0, false);
    for (let k = 0; k < 30; k++) { const u = frac(ih(k, 1, 201) + t * 0.15); P(ih(k, 2, 201) * W, LB + u * 220, 31); }
    if (lt > 0.55) { const u = lin(0.55, 0.9, lt); for (const ex of [160, 320]) { glow(ex, 212, 60, EL_T[fl(t * 10) % 4], 0.45 * u); rectF(ex - 8, 199, 6, 6, 22); rectF(ex + 3, 218, 3, 3, 19); } sparkle(154, 202, 14 * Math.sin(PI * Math.min(1, u * 1.4)), 22, 59); radialLines(240, 212, 30, 150, 22, t, 202); shk(1.5 * u); }
  });
  // 7b — rising: rocks lift, the ground splits, the aura cycles through every element
  shot(16.3, 19.3, (lt, t) => {
    const S = lerp(2.4, 3.2, lt / 3), rise = eio(lin(0.2, 2.4, lt));
    gradient(LB, 200, SKY_RED);
    tintAll(T_DARK, 0.25);
    for (let y = 200; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = vn(x, y * 2, 8, 211) > 0.55 ? 29 : 28;
    // cracks across the crater floor glowing in the element colours
    for (let k = 0; k < 12; k++) {
      const a = PI * (k / 11), e = k % 4; let x = 240, y = 214;
      for (let s = 0; s < 10; s++) { const nx = x + Math.cos(a) * 26 + (ih(k, s, 212) - 0.5) * 14, ny = y + Math.sin(a) * 4 + (ih(k, s, 213) - 0.5) * 3; lineF(x, y, nx, ny, (px, py) => { if (s < lt * 6) { P(px, py, EL[e][2]); P(px, py - 1, EL[e][1]); } }); x = nx; y = ny; }
    }
    // rocks floating up
    for (let k = 0; k < 26; k++) {
      const x = 240 + (ih(k, 1, 214) - 0.5) * 420, s = 2 + fl(ih(k, 2, 214) * 5), up = clamp(lt - ih(k, 3, 214), 0, 3) * (20 + ih(k, 4, 214) * 30);
      const y = 216 + ih(k, 5, 214) * 20 - up + Math.sin(t * 3 + k) * 2;
      rectF(x, y, s, s, 29); rectF(x, y, s, 1, 31); rectF(x, y + s - 1, s, 1, 27);
    }
    const hy = lerp(206, 140, rise);
    actor(HERO({ eyes: 'angry', sword: -1.2, legs: [1, 1, 1, 1] }), 240, hy, S, 0, false);
    const cols = AURA_RAIN(t);
    aura(t, cols, 10 + lt * 5, { sparks: 30 });
    for (let k = 0; k < 3; k++) if (ih(k, fl(t * 12), 215) < 0.5) { const a = ih(k, fl(t * 12) + 9, 215) * TAU; bolt(240 + Math.cos(a) * 20, hy - 20 + Math.sin(a) * 20, 240 + Math.cos(a) * 70, hy - 20 + Math.sin(a) * 60, fl(t * 12) + k, 1, 22, cols[2]); }
    glow(240, hy - 20, 120, EL_T[fl(t * 8) % 4], 0.3);
    shk(0.5 + lt * 0.8);
  });
  // 7c — white: TOGETHER
  shot(19.3, 19.9, (lt, t) => {
    rectF(0, 0, W, H, 60);
    radialLines(240, 135, 70, 20, 58, t, 221);
    const R = 30 + lt * 500; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - 240, y - 135); if (d < R) BUF[y * W + x] = d < R - 40 ? 22 : bay(x, y) < 0.5 ? 22 : 59; }
    shk(4);
  });
  // 7d — fable mode: a low hero shot in gold
  shot(19.9, 21.0, (lt, t) => {
    gradient(LB, H - LB, [58, 15, 14, 13, 12]);
    for (let k = 0; k < 24; k++) { const a = k / 24 * TAU + t * 0.3, w = 0.05; for (let r = 20; r < 400; r += 1) for (let q = -1; q <= 1; q++) { const aa = a + q * w * 0.3; const x = 240 + Math.cos(aa) * r, y = 150 + Math.sin(aa) * r; if ((k & 1) && bay(fl(x), fl(y)) < 0.4) P(x, y, 59); } }
    for (let y = 215; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = vn(x, y * 2, 8, 231) > 0.55 ? 29 : 28;
    actor(HERO({ eyes: 'glow', sword: -1.57, swordCols: [58, 59, 60, 59] }), 240, 170, 3.5, 0, false);
    aura(t, AURA_GOLD, 16, { sparks: 40 });
    const tip = [240 + 2 * 3.5 + 17 * 3.5, 170 - 3.5 - 29 * 3.5];
    sparkle(tip[0], tip[1], 6 + Math.sin(t * 10) * 2, 22, 59);
    for (let k = 0; k < 50; k++) { const u = frac(ih(k, 1, 232) + t * 0.6); P(240 + (ih(k, 2, 232) - 0.5) * 300, 220 - u * 200, EL[k & 3][2]); }
  });
  // 8 — take-off: up through the clouds
  shot(21.0, 22.5, (lt, t) => {
    if (lt < 0.8) {
      gradient(LB, 215, [13, 14, 15, 14]);
      ridge(215, 60, 90, 246, 12, 13, 0); ridge(215, 30, 50, 247, 11, 12, 40);
      for (let y = 215; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = vn(x, y * 2, 8, 241) > 0.55 ? 29 : 28;
      const go = lt > 0.3, hy = go ? lerp(200, -80, eic(lin(0.3, 0.55, lt))) : 200 + lt * 10;
      // gold cracks spreading under the crouch, and dust swirling in
      for (let k = 0; k < 10; k++) { const a = PI * (k / 9), L = 30 + 140 * lin(0, 0.35, lt); let x = 240, y = 216; for (let s = 0; s < 8; s++) { const nx = x + Math.cos(a) * L / 8 + (ih(k, s, 248) - 0.5) * 8, ny = y + Math.sin(a) * L / 40 + (ih(k, s, 249) - 0.5) * 2; lineP(x, y, nx, ny, s < 3 ? 22 : 59); x = nx; y = ny; } }
      for (let k = 0; k < 40; k++) { const a = ih(k, 1, 250) * TAU + lt * 6, r = (1 - frac(ih(k, 2, 250) + lt * 2)) * 120; rectF(240 + Math.cos(a) * r, 208 + Math.sin(a) * r * 0.2, 2, 1, 30); }
      if (go) { const tw = 16 * (1 - lin(0.45, 0.8, lt)) + 2; for (let y = Math.max(LB, fl(hy)); y < 216; y++) for (let q = -tw; q <= tw; q++) if (bay(fl(240 + q), y) < 1.1 - Math.abs(q) / tw) P(240 + q, y, Math.abs(q) < tw * 0.35 ? 22 : Math.abs(q) < tw * 0.7 ? 60 : 59); }
      actor(HERO({ eyes: 'glow', sword: -1.57, swordCols: [58, 59, 60, 59], sq: go ? -0.6 : 0.8, legs: go ? [0, 0, 0, 0] : [3, 3, 3, 3] }), 240, hy, 2.2, 0, false);
      if (!go) shk(1 + lt * 4);
      aura(t, AURA_GOLD, 10, { sparks: 20 });
      if (go) { const g = lt - 0.3; burst(240, 214, g * 2, 220, 20, 0.2, [22, 59], 3); shockRing(240, 214, 20 + g * 500, 6 + g * 50, 4, [22, 59, 58], 1 - g * 1.6); shockRing(240, 214, 10 + g * 300, 4 + g * 30, 3, [22, 60, 59], 1 - g * 1.6); debris(240, 212, g, 50, 160, 1.2, [29, 30, 31], 242); shk(4 * Math.exp(-g * 4)); }
    } else {
      const u = lt - 0.8;
      gradient(LB, H - LB, SKY_HIGH);
      for (let k = 0; k < 14; k++) { const y = frac(ih(k, 1, 243) + u * 2.2) * 360 - 40; cloudPuff(ih(k, 2, 243) * W, y, 18 + ih(k, 3, 243) * 26, CLOUD_RED, 244 + k); }
      const hy = lerp(260, 110, eoc(lin(0, 0.35, u)));
      actor(HERO({ eyes: 'glow', sword: -1.57, swordCols: [58, 59, 60, 59], sq: -0.25 }), 240, hy, 1.8, 0, false);
      aura(t, AURA_GOLD, 8, { sparks: 14 });
      if (u > 0.28) { const g = u - 0.28; shockRing(240, 120, 10 + g * 600, 4 + g * 120, 4, [22, 20, 19], 1 - g * 2); }
      streaks(PI / 2, 40, t, 2000, 20, 80, 245, [0, LB, W, H - 2 * LB]);
    }
  });
  // 9a — the chase: behind the hero, the Null ahead, clouds rushing at the camera
  shot(22.5, 24.0, (lt, t) => {
    gradient(LB, H - LB, SKY_HIGH);
    const VX = 240, VY = 118;
    for (let k = 0; k < 26; k++) { // clouds coming at us in perspective
      const z = frac(ih(k, 1, 251) - lt * 0.9) + 0.06, sx = (ih(k, 2, 251) - 0.5) * 900, sy = (ih(k, 3, 251) - 0.5) * 300 + 60;
      const x = VX + sx / (z * 6), y = VY + sy / (z * 6), r = 30 / z * 0.35;
      if (r > 140) continue;
      cloudPuff(x, y, r, CLOUD_HI, 252 + k);
    }
    streaks(0, 0, t, 0, 20, 0, 0);
    radialLines(VX, VY, 40, 80, 21, t, 253);
    const nx = VX + Math.sin(t * 3.2) * 40, ny = VY - 6 + Math.cos(t * 2.4) * 16;
    actor(NULLO({ eyes: 'angry' }), nx, ny, 0.9, Math.sin(t * 3.2) * 0.3, false);
    aura(t, AURA_NULL, 4, { sparks: 4 });
    // red bolts thrown back at the hero
    for (let k = 0; k < 3; k++) {
      const t0 = 0.2 + k * 0.42, u = (lt - t0) / 0.42;
      if (u <= 0 || u >= 1) continue;
      const bx = lerp(nx, 240 + (k - 1) * 90, u), by = lerp(ny, 200, u), r = 2 + u * 16;
      glow(bx, by, r * 2.2, T_RED, 0.5); discF(bx, by, r, 42); discF(bx, by, r * 0.6, 44); discF(bx, by, r * 0.3, 22);
    }
    const roll = lt > 0.75 && lt < 1.2 ? (lt - 0.75) / 0.45 * TAU : 0;
    const hx = 240 + (lt > 0.75 && lt < 1.2 ? Math.sin((lt - 0.75) / 0.45 * PI) * 60 : 0);
    actor(HERO({ eyes: 'glow', sword: -0.9, swordCols: [58, 59, 60, 59], fly: true }), hx, 200, 2.4, roll, false);
    aura(t, AURA_GOLD, 9, { sparks: 10, rise: 0.4 });
  });
  // 9b — side by side at speed: blows, a vanishing step, a strike from behind
  shot(24.0, 25.7, (lt, t) => {
    gradient(LB, 236, SKY_HIGH);
    cloudBank(236, 30, 60, 261, t * 900, CLOUD_RED, true);
    streaks(PI, 60, t, 2600, 20, 100, 262, [0, LB, W, H - 2 * LB]);
    const vanish = lt > 0.8 && lt < 1.0, behind = lt >= 1.0;
    // six blows in eight tenths of a second, each at a new height, before the hero vanishes
    const b = fl(lt * 7.5), p = frac(lt * 7.5), lunge = lt < 0.8 ? Math.sin(PI * p) : 0, dy = (ih(b, 1, 263) - 0.5) * 60;
    const nx = 312 - lunge * 14 + Math.sin(t * 5) * 3, ny = 130 + dy * 0.85 + Math.cos(t * 4) * 3;
    const hx = behind ? 360 : 168 + lunge * 22, hy = behind ? 118 : 132 + dy;
    const swing = b & 1 ? lerp(0.9, -1.6, eoc(p)) : lerp(-1.8, 0.7, eoc(p));
    actor(NULLO({ eyes: lt > 1.05 ? 'wide' : 'angry', mouth: lt > 1.05 ? 1 : 0 }), nx + (lt > 1.08 ? (lt - 1.08) * 200 : 0), ny + (lt > 1.08 ? (lt - 1.08) * 80 : 0), 1.8, lt > 1.08 ? (lt - 1.08) * 12 : -0.2, false);
    aura(t, AURA_NULL, 6, { sparks: 6, rise: 0.3 });
    if (!vanish) {
      const strike = behind && lt < 1.25;
      actor(HERO({ eyes: 'glow', sword: strike ? lerp(-2.6, 1.2, eoc(lin(1.0, 1.15, lt))) : swing, swordCols: [58, 59, 60, 59], fly: true }), hx, hy, 1.8, -0.25, behind);
      aura(t, AURA_GOLD, 7, { sparks: 8, rise: 0.3 });
    } else {
      for (let k = 0; k < 3; k++) { const u = (lt - 0.8) / 0.2; ring(200 + k * 70 * u, 132 - k * 6 * u, 10 - u * 8, undefined, 59); }
    }
    if (lt < 0.8 && p > 0.4 && p < 0.7) { const cx = (hx + nx) / 2 + 4, cy = (hy + ny) / 2 - 6, g = (p - 0.4) / 0.3; burst(cx, cy, g, 50, 10, b, [22, 59], 2); sparkle(cx, cy, 8 * (1 - g) + 2, 22, 59); glow(cx, cy, 30, T_WH, 0.5 * (1 - g)); shk(2); }
    if (behind && lt < 1.15) { glow(nx, ny, 60, T_WH, 0.6); shk(4); }
  });
  // 9c — hammered down into the sea of cloud, and back up
  shot(25.7, 27.7, (lt, t) => {
    if (lt < 0.75) {
      gradient(LB, H - LB, SKY_HIGH);
      cloudBank(250, 40, 70, 271, 0, CLOUD_RED, true);
      const hit = 0.25, sp = lt < hit ? lt / hit * TAU : 0;
      const ny = lt < hit ? 140 : lerp(140, 420, eic(lin(hit, 0.75, lt)));
      actor(NULLO({ eyes: 'wide', mouth: 1 }), 240, ny, 1.8, lt > hit ? lt * 14 : 0, false);
      actor(HERO({ eyes: 'glow', sword: lt < hit ? -1.6 + sp : 1.4, swordCols: [58, 59, 60, 59] }), 240, lt < hit ? 92 : 104, 1.8, 0, false);
      aura(t, AURA_GOLD, 8, { sparks: 10 });
      if (lt > hit && lt < hit + 0.08) { impactFrame(240, 130, 0); }
      if (lt > hit) { radialLines(240, 140, 30, 40, 22, t, 272); shk(3); }
    } else {
      // from above: a hole punched in the cloud sea, and the Null bursting back out of it
      const u = lt - 0.75;
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const n = fbm(x, y, 36, 4, 273); const d = Math.hypot(x - 240, (y - 135) * 1.3); const hole = 30 + u * 40; BUF[y * W + x] = d < hole ? (d < hole - 6 ? (vn(x, y, 6, 275) > 0.5 ? 10 : 9) : 4) : n > 0.6 ? 21 : n > 0.48 ? 20 : n > 0.38 ? 19 : 18; }
      ring(240, 135, 30 + u * 40, (30 + u * 40) / 1.3, 22);
      if (u > 0.4) {
        const v = (u - 0.4) / 0.85;
        actor(NULLO({ eyes: 'angry', mouth: 2 }), 240, lerp(140, 120, v), lerp(1, 3.2, eoc(v)), 0, false);
        aura(t, AURA_NULL, 8 + v * 14, { sparks: 30 });
        radialLines(240, 130, 40, 60, 42, t, 274);
        shk(2 + v * 2);
      }
    }
  });
  // 10a — the Null gathers a black-red orb
  shot(27.7, 28.9, (lt, t) => {
    gradient(LB, H - LB, [1, 9, 10, 9]);
    radialLines(330, 140, 50, 60, 10, t, 281);
    actor(NULLO({ eyes: 'angry', mouth: lt > 0.4 ? 2 : 1 }), 170, 160, 4, -0.05, false);
    aura(t, AURA_NULL, 18, { sparks: 30 });
    const r = 6 + eoc(lt / 1.2) * 28, ox = 330, oy = 140;
    glow(ox, oy, r * 3, T_RED, 0.6);
    for (let y = fl(oy - r); y <= oy + r; y++) for (let x = fl(ox - r); x <= ox + r; x++) { const d = Math.hypot(x - ox, y - oy) / r + (vn(x, y + t * 80, 4, 282) - 0.5) * 0.35; if (d < 1) P(x, y, d < 0.35 ? 0 : d < 0.6 ? 43 : d < 0.85 ? 42 : 44); }
    for (let k = 0; k < 3; k++) if (ih(k, fl(t * 15), 283) < 0.6) bolt(ox, oy, ox + (ih(k, fl(t * 15) + 1, 283) - 0.5) * 140, oy + (ih(k, fl(t * 15) + 2, 283) - 0.5) * 120, fl(t * 15) + k, 1, 44, 42);
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 284) - t * 1.5), a = ih(k, 2, 284) * TAU; P(ox + Math.cos(a) * u * 120, oy + Math.sin(a) * u * 90, u < 0.5 ? 42 : 43); }
    shk(1 + lt);
  });
  // 10b — the hero gathers every element on the point of the sword
  shot(28.9, 30.1, (lt, t) => {
    gradient(LB, H - LB, [5, 6, 7, 6]);
    radialLines(150, 120, 50, 60, 8, t, 291);
    const a = actor(HERO({ eyes: 'glow', sword: -0.25, swordCols: [58, 59, 60, 59] }), 330, 170, 4, 0.05, true);
    aura(t, AURA_GOLD, 18, { sparks: 30 });
    const ox = a.tip[0] - 6, oy = a.tip[1], r = 5 + eoc(lt / 1.2) * 20;
    for (let e = 0; e < 4; e++) { const ang = t * 7 + e * PI / 2, rr = r * 1.8 * (1 - lt / 1.4); const ex = ox + Math.cos(ang) * rr, ey = oy + Math.sin(ang) * rr * 0.6; glow(ex, ey, 14, EL_T[e], 0.6); discF(ex, ey, 4, EL[e][2]); discF(ex, ey, 2, 22); }
    glow(ox, oy, r * 3, T_GOLD, 0.7);
    for (let y = fl(oy - r); y <= oy + r; y++) for (let x = fl(ox - r); x <= ox + r; x++) { const d = Math.hypot(x - ox, y - oy) / r + (vn(x, y - t * 80, 4, 292) - 0.5) * 0.3; if (d < 1) P(x, y, d < 0.4 ? 22 : d < 0.7 ? 60 : EL[fl(Math.atan2(y - oy, x - ox) / TAU * 4 + 4 + t * 3) % 4][2]); }
    shk(1 + lt);
  });
  // 10c — the beams meet
  function clashAt(lt) { // where the beams meet, as they push each other back and forth (lt: 0..2.2)
    return 240 + Math.sin(lt * 2.2) * 34 * (lt < 1.4 ? 1 : 0) + (lt > 1.4 ? -(lt - 1.4) * 60 : 0) + 20 * sstep(0.6, 1.2, lt);
  }
  shot(30.1, 32.3, (lt, t) => {
    gradient(LB, 236, SKY_HIGH);
    cloudBank(226, 26, 60, 301, t * 40, CLOUD_RED, false);
    const cx = clashAt(lt), cy = 132;
    // the sea of cloud tearing under the clash
    for (let k = 0; k < 4; k++) { const r = frac(lt * 1.2 + k / 4) * 260; ring(cx, 226, r, r * 0.12, 22, (x, y) => bay(fl(x), fl(y)) < 1 - r / 260); }
    actor(NULLO({ eyes: 'angry', mouth: 2 }), 66, 132, 1.5, 0, false);
    aura(t, AURA_NULL, 7, { sparks: 8 });
    actor(HERO({ eyes: 'glow', sword: -0.05, swordCols: [58, 59, 60, 59] }), 414, 132, 1.5, 0, true);
    aura(t, AURA_GOLD, 7, { sparks: 8 });
    beam(84, 130, cx, cy, 11, [43, 42, 44, 44], t, 1);
    beam(388, 130, cx, cy, 11, [58, 58, 59, 60], t, 2);
    const R = 18 + Math.sin(t * 30) * 2 + lt * 4;
    glow(cx, cy, R * 3, T_WH, 0.6);
    for (let y = fl(cy - R); y <= cy + R; y++) for (let x = fl(cx - R); x <= cx + R; x++) { const d = Math.hypot(x - cx, y - cy) / R + (vn(x, y, 3, fl(t * 20)) - 0.5) * 0.4; if (d < 1) P(x, y, d < 0.5 ? 22 : x < cx ? 44 : 60); }
    for (let k = 0; k < 4; k++) if (ih(k, fl(t * 15), 302) < 0.7) { const a = ih(k, fl(t * 15) + 1, 302) * TAU; bolt(cx, cy, cx + Math.cos(a) * 80, cy + Math.sin(a) * 60, fl(t * 15) + k * 5, 1, 22, k & 1 ? 42 : 59); }
    shk(2.5);
  });
  // 10d — strike
  shot(32.3, 33.5, (lt, t) => {
    gradient(LB, H - LB, [58, 59, 60, 59]);
    radialLines(240, 140, 90, 70, 58, t, 311);
    actor(HERO({ eyes: 'glow', mouth: 2, sword: -0.6, swordCols: [58, 59, 60, 59] }), 236, 196, 6, 0, false);
    aura(t, [58, 59, 60, 22], 22, { sparks: 40 });
    shk(4);
  });
  // 11 — overpowered, and the light dome over the clouds
  shot(33.5, 35.5, (lt, t) => {
    if (lt < 0.8) {
      gradient(LB, 236, SKY_HIGH);
      cloudBank(226, 26, 60, 301, t * 40, CLOUD_RED, false);
      const cx = lerp(clashAt(2.2), 40, eic(lin(0, 0.6, lt))), w = 11 + eic(lin(0, 0.7, lt)) * 40;
      actor(NULLO({ eyes: 'wide', mouth: 2 }), 66, 132, 1.5, 0, false, { white: lt > 0.45 });
      if (cx - 20 > 96) beam(84, 130, cx - 20, 132, 11 * (1 - lin(0, 0.55, lt)) + 3, [43, 42, 44, 44], t, 1);
      beam(388, 130, cx - 20, 132, w, [58, 59, 60, 60], t, 2);
      if (cx - 20 > 96) { glow(cx - 20, 132, 50, T_WH, 0.7); discF(cx - 20, 132, 14 + w * 0.3, 22); }
      actor(HERO({ eyes: 'glow', sword: -0.05, swordCols: [58, 59, 60, 59] }), 414, 132, 1.5, 0, true);
      aura(t, AURA_GOLD, 9, { sparks: 10 });
      shk(3 + lt * 3);
    } else {
      const u = (lt - 0.8) / 1.2;
      gradient(LB, H - LB, [2, 3, 4, 5]);
      for (let y = 120; y < H - LB; y++) for (let x = 0; x < W; x++) { const n = fbm(x, y * 2.2, 40, 3, 321); BUF[y * W + x] = n > 0.55 ? 20 : n > 0.45 ? 19 : 18; }
      const R = 20 + eoc(u) * 240, cy = 150;
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
        const dx = x - 240, dy = (y - cy) * (y < cy ? 1 : 3.2), d = Math.hypot(dx, dy);
        if (d < R) BUF[y * W + x] = d < R * 0.55 ? 22 : d < R * 0.75 ? 60 : d < R * 0.9 ? 59 : EL[fl(d / 12 + t * 6) % 4][2];
      }
      shockRing(240, cy + 10, R * 1.3, R * 0.25, 4, [22, 20, 59], 1 - u);
      if (u < 0.1) flashWhite(1 - u * 10);
      shk(5 * (1 - u));
    }
  });
  // 12 — dawn: the Null falls apart; the hero calms
  shot(35.5, 39.1, (lt, t) => {
    gradient(LB, 210, SKY_DAWN);
    glow(360, 210, 120, T_WARM, 0.55); discF(360, 214, 24, 15); discF(360, 214, 20, 16);
    cloudBank(236, 30, 70, 331, lt * 10, CLOUD_GOLD, false);
    // the Null tumbling down and coming apart into pixels
    const nx = lerp(110, 60, lt / 3.6), ny = lerp(90, 200, lin(0, 3.6, lt));
    actor(NULLO({ eyes: 'closed' }), nx, ny, 1.4, lt * 0.8, false, { alpha: 1 - lt / 4.5 });
    for (let k = 0; k < 60; k++) { const u = frac(ih(k, 1, 332) + t * 0.4); if (ih(k, 2, 332) > lt / 3) continue; const x = nx + (ih(k, 3, 332) - 0.5) * 50 + u * 30, y = ny + (ih(k, 4, 332) - 0.5) * 30 - u * 60; rectF(x, y, 2, 2, u < 0.5 ? 42 : 40); }
    const hy = 120 + Math.sin(t * 1.6) * 4, calm = lin(1.0, 3.0, lt);
    actor(HERO({ eyes: lt > 3.0 ? 'normal' : 'glow', sword: -1.0, swordCols: calm < 0.8 ? [58, 59, 60, 59] : null }), 300, hy, 2.2, 0, lt > 2.6);
    aura(t, AURA_GOLD, 8 * (1 - calm) + 1, { sparks: Math.round(12 * (1 - calm)) });
  });
  // 13 — the title
  shot(39.1, 42, (lt, t) => {
    rectF(0, 0, W, H, 63);
    stars(t, H, 120, 341);
    const s = 'FABLE 5.5', sc = 6, w = textWidth(s, sc), x0 = 240 - w / 2;
    const nv = Math.min(s.length, fl(lt * 12));
    text(s, x0, 70, (i, j, k) => (j < 2 ? 22 : EL[k % 4][j < 5 ? 2 : 1]), sc, 0, nv);
    if (lt > 0.9) { const s2 = 'PART II · THE NULL'; text(s2, 240 - textWidth(s2, 2) / 2, 132, 59, 2, 0, fl((lt - 0.9) * 30)); }
    if (lt > 1.6) { const s3 = 'TO BE CONTINUED'; text(s3, 240 - textWidth(s3, 1) / 2, 162, 19, 1, undefined, fl((lt - 1.6) * 30)); }
    actor(HERO({ eyes: 'normal', sword: -1.0 }), 240, 210, 1.4, 0, false);
  });

  /* ================================================================ captions */
  // [t0, t1, kind, speaker, text]; kinds: n narration (top bar), s speech (bottom bar), x shout (centre)
  const CAPS = [
    [0.3, 1.7, 'n', '', 'THE FOUR ELEMENTS CHOSE A HERO.'],
    [1.8, 3.35, 'n', '', 'BUT SOMETHING ELSE WAS WATCHING.'],
    [3.8, 5.95, 's', 'NULL', 'FOUR ELEMENTS. ONE VESSEL. GIVE THEM TO ME.'],
    [6.35, 7.45, 's', 'HERO', 'NO.'],
    [13.1, 14.95, 's', 'NULL', 'IS THAT ALL THE FABLE YOU HAVE?'],
    [15.3, 16.25, 's', 'HERO', '...NOT EVEN CLOSE.'],
    [16.5, 19.25, 's', 'HERO', 'WATER. LEAF. LIGHTNING. STARLIGHT...'],
    [19.35, 20.4, 'x', '', 'TOGETHER!'],
    [20.1, 20.95, 'n', '', 'FABLE MODE'],
    [27.0, 27.65, 'x', '', 'ENOUGH!'],
    [27.95, 28.85, 's', 'NULL', 'THEN VANISH!'],
    [29.0, 30.05, 's', 'HERO', 'FABLE...'],
    [32.35, 33.45, 'x', '', 'STRIKE!', 52],
    [35.9, 37.6, 's', 'NULL', 'THIS... ISN’T... OVER.'.replace('’', "'")],
    [37.8, 39.0, 's', 'HERO', 'I KNOW.'],
  ];
  function drawCaptions(t) {
    if (t > 40.0) { const s4 = 'UNOFFICIAL FAN CONCEPT · NOT AFFILIATED WITH ANTHROPIC'; text(s4, 240 - textWidth(s4, 1) / 2, H - LB + 9, 19, 1); }
    for (const [t0, t1, k, who, s, sy] of CAPS) {
      if (t < t0 || t >= t1) continue;
      const nv = Math.ceil((t - t0) * 38);
      if (k === 'n') { const w = textWidth(s, 1); text(s, 240 - w / 2, 9, 20, 1, undefined, nv); }
      else if (k === 's') {
        const tag = who + ':', tw = textWidth(tag, 1), w = tw + 6 + textWidth(s, 1), x0 = 240 - w / 2, y = H - LB + 9;
        text(tag, x0, y, who === 'NULL' ? 42 : 35, 1);
        text(s, x0 + tw + 6, y, 21, 1, undefined, nv);
      } else {
        const u = (t - t0) / (t1 - t0), sc = u < 0.12 ? 8 : 6, w = textWidth(s, sc);
        text(s, 240 - w / 2, (sy || 135) - 3.5 * sc, (i, j) => (j < 3 ? 22 : 59), sc, 0, undefined, t);
      }
    }
  }

  /* ================================================================ frame */
  const FLASH_CUTS = [6.0, 9.7, 11.0, 12.7, 19.9, 22.5, 25.7, 30.1, 33.5];
  let SHX = 0, SHY = 0;
  function render(t) {
    t = clamp(t, 0, D - 1 / 30);
    T_NOW = t; SHAKE_A = 0; BUF.fill(0);
    let S = SHOTS[0];
    for (const s of SHOTS) if (t >= s.t0) S = s;
    S.fn(t - S.t0, t);
    if (S.fn !== SHOTS[SHOTS.length - 1].fn || true) letterbox(LB);
    for (const c of FLASH_CUTS) if (t >= c && t < c + 0.067) tintAll(T_WH, 0.55);
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
  (window.PIECES = window.PIECES || []).push({
    id: 'the-null',
    title: 'The Null',
    medium: 'Pixel art in 64 colours, 480 × 270, drawn in JavaScript · 42 s',
    note: 'Fable Saga, part II · tap to pause',
    about: 'Part two of the Fable saga. The sky over the forest cracks open and the Null, a glitched shadow of the coral hero, comes for the four elements. They clash on the ground and in the trees, the hero is beaten into a crater, then calls the elements together, turns gold and takes the fight above the clouds: a chase, a barrel roll, a blow that sends the Null through the cloud sea, and a beam struggle that ends in a dome of light at dawn. An unofficial fan concept, not affiliated with Anthropic.',
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
        window.__thenull = {
          duration: D,
          isReady: () => ready && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__thenull.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-null';
        api.ready();
      } else {
        window.__thenull = { duration: D, isReady: () => ready, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
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
          if (window.__thenull) delete window.__thenull;
        },
      };
    },
  });
})();
